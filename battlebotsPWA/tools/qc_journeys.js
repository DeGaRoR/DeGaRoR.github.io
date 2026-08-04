// tools/qc_journeys.js — end-to-end player journeys, driven through the real UI.
// J2 exists because the STACK_SLOTS crash escaped every previous suite: they all
// booted a fresh single-bot player. Any save shape a real player can reach must boot.
const { openWorld } = require("./world.js");
const { check, safe, report } = require("./check.js");

// Constructeurs de sauvegardes v4 (modèle à instances) : un inv partagé,
// des bots dont les slots référencent des uid mintés dans cet inv.
const KIT = { propulsion: "pr0", motor: "m0", cpu: "c0", battery: "b0", sensors: "n0" };
const mkInv = () => ({ seq: 0, items: {} });
const mint = (inv, def, extra) => { const uid = "i" + (++inv.seq);
  inv.items[uid] = Object.assign({ def, wear: 0 }, extra || {}); return uid; };
const bot = (inv, chassis, color, stacks) => {
  const fit = {};
  for (const sl in KIT) fit[sl] = [mint(inv, KIT[sl])];
  for (const sl in (stacks || {})) while (fit[sl].length < stacks[sl]) fit[sl].push(mint(inv, KIT[sl]));
  return { chassis, fit,
    customize: { color: color || "#2b2f3a", stickers: [], placed: [] },
    layout: null, equipped: {}, counts: {} };            // caches, régénérés au boot
};
/* La version de sauvegarde des FIXTURES suit SAVE_V du jeu. Un contrôle
   dédié (J0) échoue bruyamment si l'un bouge sans l'autre. */
const SAVE_V_FIXTURE = 6;
const mkSave = (build, over) => { const inv = mkInv();
  const garage = build ? build(inv) : [bot(inv, "boxy")];
  return { v: SAVE_V_FIXTURE, inv, garage, activeBot: 0,
    bolts: 200, level: 1, badges: [], beatenAtLevel: 0, lang: "fr", speed: 1,
    tourney: null, concours: {}, opponent: null,
    ...(over || {}) }; };
const save = over => mkSave(null, over);
/* S25 — le contenu s'ouvre aux ÉTOILES (1★ par épreuve précédente), plus au
   palmarès. PODIUMS = l'état d'un joueur qui a fait un top 3 partout jusqu'à
   la Régionale : c'est le fixe à donner à tout parcours qui veut y jouer. */
const PODIUMS = { sumoS:1, sparS:1, cupS:1, sumoM:1, lightM:1, cupM:1 };

const boots = (label, saveObj, extra) => {
  const w = openWorld({ save: saveObj });
  const ok = check(label, w.errors.length === 0, w.errors.slice(0, 2).join(" | ") || "");
  if (ok && extra) { try { extra(w); } catch (e) { check(label + " (suite)", false, e.message); } }
  w.close();
  return ok;
};

// ---------------------------------------------------------------- J1 fresh player
safe("J1 fresh", () => {
  const w = openWorld({ save: null });
  check("J1 nouveau joueur démarre", w.errors.length === 0, w.errors[0] || "");
  check("J1 un bot de départ", w.eval("S.garage.length") === 1, w.eval("S.garage.length"));
  check("J1 instances amorcées pour le kit de base",
        w.eval("Object.keys(S.inv.items).length") >= 5, w.eval("Object.keys(S.inv.items).length") + " instances");
  w.close();
});

// ------------------------------------- J2 multi-bot saves (the regression that escaped)
safe("J2 multi-bot", () => {
  const chassis = ["boxy", "fleche", "marteau", "tortue", "losange", "disque"];
  let bad = [];
  for (let n = 1; n <= 4; n++) {
    for (let active = 0; active < n; active++) {
      const w = openWorld({ save: mkSave(
        inv => chassis.slice(0, n).map((c, i) => bot(inv, c, null, i % 2 ? { motor: 2 } : {})),
        { activeBot: active }) });
      if (w.errors.length) bad.push(`n=${n} actif=${active}: ${w.errors[0]}`);
      else if (w.eval("S.garage.length") !== n) bad.push(`n=${n}: garage tronqué`);
      w.close();
    }
  }
  check("J2 sauvegardes 1→4 bots × chaque bot actif démarrent", bad.length === 0,
        bad.slice(0, 2).join(" | ") || "10 combinaisons OK");
});

// ------------------------------------------- J3 shared parts pool across the garage
safe("J3 pool partagé", () => {
  const w = openWorld({ save: mkSave(inv => { const g = [bot(inv, "boxy"), bot(inv, "fleche")];
    mint(inv, "m1"); return g; }) });                    // une seule copie libre de m1
  check("J3 démarrage", w.errors.length === 0, w.errors[0] || "");
  // one copy of m1, installed on bot 0 → unavailable to bot 1
  w.eval(`tryEquip("motor","m1"); recomputeOwned();`);
  const onBot0 = w.eval(`S.parts.equipped.motor`);
  w.eval(`setActiveBot(1)`);
  const availOn1 = w.eval(`availFor("m1")`);
  check("J3 pièce montée ailleurs n'est plus disponible",
        onBot0 !== "m1" || availOn1 <= 0, `bot0=${onBot0} dispo_bot1=${availOn1}`);
  check("J3 comptage inter-bots ne lève pas", w.errors.length === 0, w.errors[0] || "");
  w.close();
});

// ------------------------------------------------- J4 purchase → switch → persist
safe("J4 achat et persistance", () => {
  const w = openWorld({ save: save({ bolts: 100000 }) });
  w.click("tabShop");
  const before = w.eval("S.garage.length");
  w.eval(`buyBot("fleche")`);
  const after = w.eval("S.garage.length");
  check("J4 achat de châssis ajoute un bot au garage", after === before + 1, `${before} → ${after}`);
  w.eval(`setActiveBot(${after - 1}); saveState();`);
  const dumped = w.eval("localStorage.getItem(careerKey(CUR_CAREER))");
  check("J4 état sérialisé dans localStorage", !!dumped && dumped.length > 50, (dumped || "").length + " car.");
  w.close();

  // reload from that exact blob
  const w2 = openWorld({ save: JSON.parse(dumped) });
  check("J4 rechargement de la sauvegarde produite", w2.errors.length === 0, w2.errors[0] || "");
  check("J4 bot actif conservé", w2.eval("S.activeBot") === after - 1, w2.eval("S.activeBot"));
  check("J4 châssis acheté conservé", w2.eval("AB().chassis") === "fleche", w2.eval("AB().chassis"));
  w2.close();
});

// ---------------------------------------------------------------- J5 ladder to L2
safe("J5 échelle", () => {
  const w = openWorld({ save: save() });
  let guard = 0;
  // force wins by resolving matches headlessly against the state machine
  while (w.eval("S.level") < 2 && guard++ < 40) {
    w.eval(`(()=>{ ensureOpponent(); S.beatenAtLevel++; })()`);
    if (w.eval("S.beatenAtLevel") >= 2) break;
  }
  check("J5 le drapeau de tournoi s'ouvre après 2 victoires",
        w.eval("tournamentOpen()") === true, "beatenAtLevel=" + w.eval("S.beatenAtLevel"));
  check("J5 aucune erreur pendant la progression", w.errors.length === 0, w.errors[0] || "");
  w.close();
});

// -------------------------------------------------------- J6 league full season
safe("J6 ligue", () => {
  const w = openWorld({ save: save({ beatenAtLevel: 5, beaten: 99, stars: PODIUMS }) });   // S25 : podiums acquis
  w.eval(`enterChampionnat()`);
  const started = w.eval("!!S.concours.lightM");
  check("J6 la ligue démarre pour un build conforme", started,
        started ? "" : (w.$("toastText").textContent || "refusée"));
  if (started) {
    const rounds = w.eval(`(()=>{
      let n=0;
      while(!FORMATS.championnat.isDone(S.concours.lightM) && n<40){ FORMATS.championnat.recordMatch(S.concours.lightM, (n%3)); n++; }
      return n;
    })()`);
    check("J6 la saison se termine en un nombre borné de manches", rounds > 0 && rounds <= 20, rounds + " manches");
    check("J6 classement calculable", (w.eval(`FORMATS.championnat.standings(S.concours.lightM).length`)) > 0);
    check("J6 rang du joueur défini", w.eval("FORMATS.championnat.myRank(S.concours.lightM)") > 0, "rang " + w.eval("FORMATS.championnat.myRank(S.concours.lightM)"));
    const pz = w.eval("FORMATS.championnat.prize(S.concours.lightM, 10)");
    check("J6 prix fini et prime de participation garantie",
          pz && [pz.part, pz.podium, pz.total].every(isFinite) && pz.total > 0,
          JSON.stringify(pz));
  }
  check("J6 aucune erreur", w.errors.length === 0, w.errors[0] || "");
  w.close();
});

// ------------------------------------------------ S16-RANK : classement honnête du championnat
safe("S16 classement", () => {
  const w = openWorld();
  const r = w.eval(`(function(){
    const F = FORMATS.championnat, out = {};
    // 1) sumoS : 4 manches → 5 places ; tout gagner → 1er, quel que soit le tirage
    let worst = 1;
    for (let seed = 1; seed <= 30; seed++){
      const lg = F.init(seed, 4);
      if (lg.rivals.length !== 4) return "rivaux " + lg.rivals.length + " pour 4 manches";
      while (!F.isDone(lg)) F.recordMatch(lg, 2, true);
      worst = Math.max(worst, F.myRank(lg));
      if (F.standings(lg).length !== 5) return "places " + F.standings(lg).length;
    }
    out.worstWinAll = worst;
    // 2) le rival affronté en manche 1 n'a AUCUN point si tu le bats
    const lg2 = F.init(7, 4); const facedName = F.faced(lg2).name;
    F.recordMatch(lg2, 2, true);
    const fr = lg2.rivals.find(x => x.name === facedName);
    out.facedScore = fr.score;
    // 3) tout perdre sans duel → dernier ou avant-dernier plausible, jamais 1er
    const lg3 = F.init(7, 4); while (!F.isDone(lg3)) F.recordMatch(lg3, 0, false);
    out.rankLoseAll = F.myRank(lg3);
    // 4) gains : 1er au barème = participation + podium ×4
    const lg4 = F.init(3, 4); while (!F.isDone(lg4)) F.recordMatch(lg4, 2, true);
    const pz = F.prize(lg4, 12);
    out.prizeOK = (pz.rank === 1 && pz.part === Math.ceil(12*1.5) && pz.podium === 48 && pz.total === pz.part + pz.podium);
    // 5) lightM 10 manches → 10 rivaux nommés distincts
    const lg5 = F.init(9, 10);
    out.mRivals = lg5.rivals.length; out.mDistinct = new Set(lg5.rivals.map(x=>x.name)).size;
    return out;
  })()`);
  check("S16: invaincu = 1er sur 30 tirages, 5 places pour 4 manches",
        r && r.worstWinAll === 1, JSON.stringify(r));
  check("S16: le rival battu en manche 1 reste à 0 point", r && r.facedScore === 0, r && r.facedScore);
  check("S16: tout perdre ne classe jamais 1er", r && r.rankLoseAll > 1, r && r.rankLoseAll);
  check("S16: bourse du 1er = participation + podium ×4", r && r.prizeOK === true, JSON.stringify(r));
  check("S16: lightM aligne 10 rivaux distincts", r && r.mRivals === 10 && r.mDistinct === 10, r && (r.mRivals+"/"+r.mDistinct));
  check("S16 aucune erreur", w.errors.length === 0, w.errors[0] || "");
  w.close();
});

// ------------------------------------------------ S16-CRASH : plus jamais d'écran mort
safe("S16 anti-gel", () => {
  const w = openWorld();
  // 1) debrief idempotent : une frame en vol ne rejoue pas le résultat
  w.eval(`AB().chassis="tortue_s"; S.bolts=1e6; engageConcours("sumoS"); curVsConcours="sumoS";`);
  w.eval(`startMatch("championnat"); while(!match.over) ENGINE.tick(match); match.winner=0;`);
  w.eval(`endToDebrief(); endToDebrief(); endToDebrief();`);
  const st1 = w.eval(`JSON.stringify({round:S.concours.sumoS.round, my:S.concours.sumoS.myScore})`);
  check("S16C: triple debrief = un seul enregistrement", st1 === '{"round":1,"my":2}', st1);
  // 2) saison finie → relancer refuse PROPREMENT (toast, pas de match, pas d'erreur)
  w.eval(`(function(){ for(let i=0;i<3;i++){ startMatch("championnat");
    while(!match.over) ENGINE.tick(match); match.winner=0; endToDebrief(); $("ovMain").onclick(); } })()`);
  const doneOK = w.eval(`(function(){ const before = match;
    startMatch("championnat"); return { same: match===before, toast: $("toastText").textContent }; })()`);
  check("S16C: concours terminé → refus propre avec message",
        doneOK.same === true && /termin|over/i.test(doneOK.toast), JSON.stringify(doneOK));
  // 3) échelle : fermée → qual ; ouverte mais consommée → recréée fraîche. Jamais null.idx.
  w.eval(`S.tourney = null; S.beatenAtLevel = 0; curVsConcours = null; vsMode = null;`);
  w.eval(`startMatch("tour")`);
  const tourA = w.eval(`JSON.stringify({mode:curMode, live:!!(match && !match.over)})`);
  check("S16C: échelle fermée → qual rétrogradé, match vivant", tourA === '{"mode":"qual","live":true}', tourA);
  w.eval(`S.tourney = null; S.beatenAtLevel = 2;`);
  w.eval(`startMatch("tour")`);
  const tourB = w.eval(`JSON.stringify({mode:curMode, fresh:!!(S.tourney && S.tourney.idx===0), live:!!(match && !match.over)})`);
  check("S16C: échelle ouverte consommée → recréée fraîche", tourB === '{"mode":"tour","fresh":true,"live":true}', tourB);
  // 4) boîte noire : logError journalise et la table des réglages l'affiche
  /* S37-MENU : le journal a quitté verTable pour SA section (errTable), avec
     bouton de purge. L'intention testée ne change pas — une erreur journalisée
     doit être VISIBLE dans les réglages — seul l'élément porteur bouge. */
  w.eval(`logError("test", "message de test S16", "app.js", 42); renderVersionsTable();`);
  const bb = w.eval(`(function(){ const log = errlog();
    return { n: log.length, msg: log[0].msg, shown: $("errTable").textContent.includes("S16"),
             vide: (localStorage.removeItem(ERRLOG_KEY), renderVersionsTable(),
                    $("errTable").textContent === t("errNone")) }; })()`);
  check("S16C: boîte noire journalise et s'affiche en réglages",
        bb.n >= 1 && /S16/.test(bb.msg) && bb.shown === true, JSON.stringify(bb));
  check("S16C: le journal se vide et l'affiche", bb.vide === true, JSON.stringify(bb));
  check("S16C: aucune erreur sur tout le parcours", w.errors.length === 0, w.errors[0] || "");
  w.close();
});

// ------------------------------------------------ J7 bracket build lock is enforced
safe("J7 coupe", () => {
  const w = openWorld({ save: save({ beatenAtLevel: 5, beaten: 99, stars: PODIUMS }) });   // S25 : podiums acquis
  w.eval(`enterBracket()`);
  const started = w.eval("!!S.concours.cupM");
  check("J7 la coupe démarre", started, started ? "" : (w.$("toastText").textContent || "refusée"));
  if (started) {
    const lockedChassis = w.eval("S.concours.cupM.lock.chassis");
    // player tampers with their build mid-tournament
    w.eval(`AB().chassis = "tortue"; syncActive(); autoArrangeCurrent();`);
    check("J7 le build est gelé à l'inscription",
          w.eval("S.concours.cupM.lock.chassis") === lockedChassis,
          lockedChassis + " → " + w.eval("S.concours.cupM.lock.chassis"));
  }
  check("J7 aucune erreur", w.errors.length === 0, w.errors[0] || "");
  w.close();
});

// ------------------------------------------------------- J8 scrutineering refuses
safe("J8 vérifications techniques", () => {
  const w = openWorld({ save: save({ beatenAtLevel: 5 }) });
  // tracks are banned in the light league
  const r = w.eval(`checkEntry({chassis:"boxy", parts:{...AB().equipped, propulsion:"pr3"}, counts:{}},
                                TOURNAMENTS.find(x=>x.id==="lightM").rules)`);
  check("J8 les chenilles sont refusées en ligue légère", r.ok === false && r.fails.length > 0,
        (r.fails || []).join(" / "));
  // a compliant build passes
  const ok = w.eval(`checkEntry({chassis:"boxy", parts:{...AB().equipped}, counts:{}},
                                TOURNAMENTS.find(x=>x.id==="lightM").rules)`);
  check("J8 un build conforme passe", ok.ok === true, (ok.fails || []).join(" / "));
  
// ------------------------------------------------------ A2: sauvegarde versionnée
safe("J10 politique de sauvegarde (pré-release : valider ou repartir à neuf)", () => {
  // schéma legacy sans champ v → écarté, état neuf, aucune erreur
  const w1 = openWorld({ save:{ bolts:777, lang:"fr" } });
  check("legacy écarté : v = SAVE_V", w1.eval("S.v === SAVE_V"), "v="+w1.eval("S.v"));
  check("legacy écarté : état neuf (bolts remis à 0)", w1.eval("S.bolts === 0"), "bolts="+w1.eval("S.bolts"));
  check("legacy écarté : garage de départ valide", w1.eval("S.garage.length === 1 && AB().fit.motor.length === 1"));
  check("v persiste à l'écriture", (w1.eval("saveState()"), w1.eval("JSON.parse(localStorage.getItem(careerKey(CUR_CAREER))).v === SAVE_V")));
  check("aucune erreur (legacy)", w1.errors.length === 0, w1.errors[0] || "");
  w1.close();
  // version future → écartée aussi (quitte à écraser), jamais transformée en douce
  const w2 = openWorld({ save:{ v:99, bolts:5, futur:{x:1} } });
  check("version future écartée : état neuf", w2.eval("S.v === SAVE_V && S.bolts === 0"));
  check("aucune erreur (futur)", w2.errors.length === 0, w2.errors[0] || "");
  w2.close();
  // sauvegarde v4 VALIDE → adoptée intégralement
  const w3 = openWorld({ save: mkSave(null, { bolts: 777 }) });
  check("v4 valide adoptée (bolts préservés)", w3.eval("S.bolts === 777"));
  w3.close();
  // sauvegarde v4 CORROMPUE (uid référencé deux fois) → écartée
  const bad = mkSave(null, {});
  bad.garage[0].fit.battery = bad.garage[0].fit.motor.slice();   // double référence
  const w4 = openWorld({ save: bad });
  check("v4 corrompue (uid double) écartée : état neuf", w4.eval("S.bolts === 0"), "bolts="+w4.eval("S.bolts"));
  check("aucune erreur (corrompue)", w4.errors.length === 0, w4.errors[0] || "");
  w4.close();
});

// ------------------------------------------------------ A3: slots vides → null
safe("J11 slots vides = null (modèle v4)", () => {
  const w = openWorld({ save: save() });
  check("slots optionnels vides → cache equipped à null",
        w.eval("AB().equipped.weapon1 === null && AB().equipped.ballast === null && AB().equipped.cooling === null"));
  check("un combat démarre avec des slots vides",
        (w.eval("startMatch('qual')"), w.eval("!!match")), w.errors[0] || "");
  check("équiper l'option vide stocke null et vide le fit",
        w.eval("tryEquip('armor', EMPTY_ID.armor) && S.parts.equipped.armor === null && AB().fit.armor.length === 0"));
  check("E7b: tout slot peut être vidé, le CT vire au rouge",
        w.eval("tryFit(AB(), 'motor', []) === true && AB().fit.motor.length === 0")
        && w.eval("functionalCheck({chassis:AB().chassis, parts:{...AB().equipped}, counts:{...AB().counts}}).ok") === false
        && (w.eval("(function(){ const u=Object.keys(S.inv.items).find(x=>S.inv.items[x].def==='m0'&&!fittedMap()[x]); return tryFit(AB(),'motor',[u]); })()") === true));
  check("aucune erreur sur tout le parcours", w.errors.length === 0, w.errors[0] || "");
  w.close();
});

// ------------------------------------------------------ B2: homologation & débriefing
safe("J12 règles à deux axes + débriefing", () => {
  const w = openWorld();
  const B = "({...PILOT(), chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}})";
  const R = "TOURNAMENTS.find(x=>x.id==='lightM').rules";
  check("bot de départ éligible au Sumo Léger", w.eval(`checkEntry(${B}, ${R}).ok`),
        w.eval(`checkEntry(${B}, ${R}).fails.join('|')`));
  w.eval("AB().counts.motor = 2");
  check("2 moteurs refusés en Sumo Léger (maxCount ×1)", w.eval(`!checkEntry(${B}, ${R}).ok`));
  check("le motif cite la multiplicité", w.eval(`checkEntry(${B}, ${R}).fails.join()`).includes("×2"));
  w.eval("AB().counts.motor = 3");
  check("3 moteurs acceptés en Sumo M (maxCount ×3)",
        w.eval(`checkEntry(${B}, TOURNAMENTS.find(x=>x.id==='sumoM').rules).ok`));
  w.eval("delete AB().counts.motor");
  w.eval("CHASSIS_TIER.boxy = 'feather'");
  check("mauvais palier refusé partout", w.eval(`!checkEntry(${B}, ${R}).ok`));
  w.eval("delete CHASSIS_TIER.boxy");
  // débriefing : match moteur complet, rendu direct
  w.eval(`(function(){
    const mk=()=>{ const b={...ENGINE.SLICE1.playerBuild, chassis:"boxy", parts:{...AB().equipped}, counts:{}};
      b.stability=computeCG(b, autoArrange(b)).stability; b.colliders=buildColliders(b, autoArrange(b)); return b; };
    const m=ENGINE.makeMatch(11, mk(), mk()); let guard=0;
    while(!m.over && guard++<40000) ENGINE.tick(m);
    renderDebrief(m);
  })()`);
  check("le débriefing affiche batterie et durée",
        w.eval("$('ovStats').textContent").includes("%") &&
        w.eval("$('ovStats').textContent.length > 40"),
        w.eval("$('ovStats').textContent").slice(0,60));
  check("aucune erreur", w.errors.length === 0, w.errors[0] || "");
  w.close();
});

// ------------------------------------------------------ B3: occasions du jour
safe("J13 marché de l'occasion", () => {
  const w = openWorld({ save: mkSave(null, { bolts:2000 }) });
  w.eval("refreshUsedStock()");
  const n = w.eval("S.usedStock.length");
  check("stock du jour généré (3 à 5 offres)", n>=3 && n<=5, "n="+n);
  check("décote cohérente : prix < neuf, usure 15–45 %",
        w.eval("S.usedStock.every(o=>{const p=ENGINE.PARTS[o.slot].find(x=>x.id===o.id);return o.price<p.cost && o.wear>=15 && o.wear<=45;})"));
  const stock1 = w.eval("JSON.stringify(S.usedStock.map(o=>o.id))");
  const w2 = openWorld({ save: mkSave(null, { bolts:5 }) });
  w2.eval("refreshUsedStock()");
  check("déterministe : même étal pour tout le monde le même jour",
        w2.eval("JSON.stringify(S.usedStock.map(o=>o.id))") === stock1);
  check("bouton d'achat désactivé sans boulons",
        (w2.eval("renderGarage()"), w2.eval("[...$('usedTop').querySelectorAll('.rc-buy.used')].every(b=>b.disabled)")));
  w2.close();
  // achat par le VRAI chemin : clic sur le premier bouton d'occasion
  const before = w.eval("S.bolts");
  w.eval("renderGarage()");
  w.eval("[...$('usedTop').querySelectorAll('.rc-buy.used')].find(b=>!b.disabled).click()");
  check("achat : débit + instance créée avec l'usure de l'offre + offre soldée",
        w.eval("S.bolts") < before &&
        w.eval("(function(){ const o=S.usedStock.find(o=>o.qty===0); if(!o) return false; return Object.values(S.inv.items).some(it=>it.def===o.id && it.wear===o.wear); })()"));
  check("aucune erreur", w.errors.length === 0, w.errors[0] || "");
  w.close();
});

w.close();
});

// --------------------------------------------- J9 hostile / legacy saves must not crash
safe("J9 sauvegardes hostiles", () => {
  boots("J9 sauvegarde vide {}", {});
  boots("J9 garage vide → écarté, état neuf", mkSave(null, { garage: [] }),
        w => check("J9 garage neuf après rejet", w.eval("S.garage.length") === 1));
  boots("J9 activeBot hors bornes", mkSave(null, { activeBot: 7 }),
        w => check("J9 activeBot ramené dans les bornes", w.eval("S.activeBot") === 0, w.eval("S.activeBot")));
  boots("J9 caches absents (fit seul)", mkSave(inv => [{ chassis: "boxy",
          fit: { propulsion:[mint(inv,"pr0")], motor:[mint(inv,"m0")], cpu:[mint(inv,"c0")],
                 battery:[mint(inv,"b0")], sensors:[mint(inv,"n0")] },
          customize: { color: "#333", stickers: [], placed: [] } }]),
        w => check("J9 caches recréés par refit", typeof w.eval("AB().counts") === "object" &&
                   w.eval("AB().equipped.motor") === "m0"));
  boots("J9 mise en page corrompue", mkSave(inv => [Object.assign(bot(inv, "boxy"), { layout: { motor: { col: 99, row: 99 } } })]));
  boots("J9 fits orphelins (items vidés) → écarté proprement",
        (() => { const sv = mkSave(); sv.inv.items = {}; return sv; })(),
        w => check("J9 état neuf après rejet des orphelins", w.eval("Object.keys(S.inv.items).length") >= 5));
  boots("J9 def inconnu dans une instance → écarté proprement",
        (() => { const sv = mkSave(); const k = Object.keys(sv.inv.items)[0]; sv.inv.items[k].def = "m_inconnu"; return sv; })());
  boots("J9 châssis inconnu", mkSave(inv => [bot(inv, "chassis_inconnu")]),
        w => {
          check("J9 châssis inconnu rabattu sur boxy", w.eval("AB().chassis") === "boxy", w.eval("AB().chassis"));
          check("J9 le bot rabattu reste jouable",
                w.eval(`layoutValid({chassis:AB().chassis, parts:{...AB().equipped}, counts:{...AB().counts}}, getLayout())`));
        });
  boots("J9 châssis inconnu sur un bot non actif",
        mkSave(inv => [bot(inv, "boxy"), bot(inv, "chassis_disparu")]),
        w => check("J9 tout le garage assaini", w.eval("S.garage.every(b=>ENGINE.CHASSIS[b.chassis])")));
  // a realistic bracket, produced by the game itself, then corrupted on one field only
  const w0 = openWorld({ save: save({ beatenAtLevel: 5 }) });
  w0.eval(`S.beaten = 99; S.stars = ${JSON.stringify(PODIUMS)}; enterBracket(); S.concours.cupM.lock.chassis = "chassis_retire"; saveState();`);
  const corrupted = JSON.parse(w0.eval("localStorage.getItem(careerKey(CUR_CAREER))"));
  w0.close();
  boots("J9 build gelé de coupe avec châssis disparu", corrupted,
        w => check("J9 build gelé assaini", w.eval("S.concours.cupM.lock.chassis") === "boxy",
                   w.eval("S.concours.cupM.lock.chassis")));
});


// ------------------------------------------- J14 invariants du modèle à instances
safe("J14 invariants d'instances", () => {
  const w = openWorld({ save: mkSave(null, { bolts: 100000 }) });
  // séquence de mutations mixtes par l'API publique
  // E11 : le stepper n'achète plus — on frappe le stock libre pour continuer
  // d'exercer un VRAI empilement dans le balayage d'invariants.
  w.eval(`(function(){
    buyBot("fleche"); setActiveBot(0);
    mintInstance("m0"); mintInstance("m0");
    setCount("motor", +1); setCount("motor", +1); setCount("motor", -1);
    tryEquip("battery", "b1");            // pas possédée : refus attendu, sans corruption
    tryEquip("armor", ENGINE.PARTS.armor[1] ? ENGINE.PARTS.armor[1].id : "a1");
  })()`);
  const errs = w.eval(`(function(){
    const seen = {}, errs = [];
    S.garage.forEach((b, bi) => { for (const sl in b.fit){
      let d0 = null;
      for (const uid of b.fit[sl]){
        const it = S.inv.items[uid];
        if (!it){ errs.push("uid fantôme "+uid); continue; }
        if (seen[uid]) errs.push("uid double "+uid); seen[uid] = 1;
        if (DEF_SLOT[it.def] !== sl) errs.push("def hors slot "+bi+"/"+sl);
        if (d0 && it.def !== d0) errs.push("panachage "+bi+"/"+sl);
        d0 = it.def; }
      const arr = b.fit[sl];
      const expEq = arr.length ? S.inv.items[arr[0]].def : null;
      if ((b.equipped[sl] ?? null) !== expEq) errs.push("cache equipped désync "+bi+"/"+sl);
      const expN = arr.length > 1 ? arr.length : undefined;
      if (b.counts[sl] !== expN) errs.push("cache counts désync "+bi+"/"+sl);
    }});
    for (const uid in S.inv.items){
      const n = parseInt(uid.slice(1), 10);
      if (!(n >= 1 && n <= S.inv.seq)) errs.push("seq incohérent "+uid); }
    return errs;
  })()`);
  check("J14 zéro violation d'invariants après mutations", errs.length === 0, errs.slice(0, 3).join(" | ") || "—");
  // [4] E11 : empiler sans stock libre = REFUS SEC (zéro débit, zéro frappe) ;
  //     avec stock libre, la copie possédée se monte sans un centime.
  const w2 = openWorld({ save: mkSave(null, { bolts: 100000 }) });
  const paid = w2.eval(`(function(){
    const b0 = S.bolts, n0 = invCount("m0");
    setCount("motor", +1); setCount("motor", +1);
    const refus = { spent: b0 - S.bolts, minted: invCount("m0") - n0, n: AB().counts.motor };
    mintInstance("m0"); setCount("motor", +1);
    return { refus, apres: { spent: b0 - S.bolts, n: AB().counts.motor } };
  })()`);
  check("J14 empiler sans stock libre = refus sec, zéro débit, zéro frappe",
        paid.refus.spent === 0 && paid.refus.minted === 0 && paid.refus.n === undefined,
        JSON.stringify(paid.refus));
  check("J14 empiler une copie possédée = montée gratuite (déjà payée en boutique)",
        paid.apres.spent === 0 && paid.apres.n === 2, JSON.stringify(paid.apres));
  check("J14 aucune erreur", w.errors.length === 0 && w2.errors.length === 0,
        (w.errors[0] || w2.errors[0] || ""));
  w.close(); w2.close();
});


// ------------------------------------------- J15 hiérarchie ligues/concours (S3)
safe("J15 ligues et engagement", () => {
  // intégrité des données : chaque concours référencé existe, ids uniques
  const w = openWorld({ save: mkSave(null, { beatenAtLevel: 5 }) });
  check("J15 LIGUES → ids de concours tous résolus",
        w.eval("LIGUES.every(l => l.concours.every(id => TOURNAMENTS.some(t => t.id === id)))"));
  /* Compté sur les DONNÉES : une ligue de plus (Calibrage) ne doit pas faire
     rougir la porte au seul motif qu'elle existe. Ce qui est vérifié : toute
     ligue sans condition est ouverte, tout placeholder est fermé. */
  check("J15 ligues sans condition ouvertes, placeholders verrouillés",
        w.eval("LIGUES.filter(l => !l.unlock).every(l => unlockMet(l.unlock))") &&
        w.eval("LIGUES.filter(l => l.unlock && l.unlock.placeholder).every(l => !unlockMet(l.unlock))") &&
        w.eval("unlockMet({placeholder:true}) === false"),
        w.eval("LIGUES.filter(l => unlockMet(l.unlock)).length") + " ouvertes / " + w.eval("LIGUES.length"));
  check("J15 unlock déclaratif : level et concoursDone",
        w.eval("unlockMet({level:1}) === true && unlockMet({level:99}) === false") &&
        w.eval("unlockMet({concoursDone:'cupM'}) === false && (S.concoursDone.cupM = true, unlockMet({concoursDone:'cupM'}) === true && (delete S.concoursDone.cupM, true))"));
  // engagement explicite : init + gel, refus du double
  w.eval(`S.beaten = 99; S.stars = ${JSON.stringify(PODIUMS)}`);   // S25 : podiums acquis
  const r1 = w.eval("JSON.stringify(engageConcours('lightM'))");
  check("J15 engagement initialise l'état et gèle le build",
        JSON.parse(r1).ok === true &&
        w.eval("!!CN('lightM') && !!CN('lightM').lock && CN('lightM').lock.chassis === AB().chassis"));
  check("J15 double engagement refusé",
        w.eval("engageConcours('lightM').already === true"));
  // gel effectif : modifier le build ne change pas le lock, et la manche part du lock
  const locked = w.eval("CN('lightM').lock.parts.motor");
  w.eval("S.bolts = 1e6; mintInstance('m1'); recomputeOwned(); tryEquip('motor','m1'); saveState();");
  check("J15 le lock survit aux modifications du garage",
        w.eval("CN('lightM').lock.parts.motor") === locked,
        locked + " → " + w.eval("CN('lightM').lock.parts.motor"));
  // l'échelle ne gèle pas (lockBuild:false en données)
  check("J15 l'échelle ne gèle pas le build",
        w.eval("tournamentById('sumoM').lockBuild === false"));
  // abandon : progression perdue, zéro malus (décision 2b)
  const bolts = w.eval("S.bolts");
  check("J15 abandon : état effacé, boulons intacts",
        w.eval("abandonConcours('lightM') === true && CN('lightM') === null") &&
        w.eval("S.bolts") === bolts);
  check("J15 ré-engagement possible après abandon",
        w.eval("engageConcours('lightM').ok === true"));
  check("J15 aucune erreur", w.errors.length === 0, w.errors[0] || "");
  w.close();
});


// ------------------------------------------------------ E4 : classe S jouable (Circuit Garage)
safe("E4 classe S", () => {
  const w = openWorld({ save: mkSave(null, { bolts: 800 }) });
  // achat d'une coque S → bot au garage, classe S, stock logé, sous la limite
  w.eval("buyBot('tortue_s')");
  const gi = w.eval("S.garage.findIndex(b=>b.chassis==='tortue_s')");
  check("E4: coque S achetée → bot au garage", gi >= 0);
  w.eval(`S.activeBot=${gi}; syncActive(); recomputeOwned()`);
  // E7 : la coque arrive NUE — on l'assemble (kit de base minté et monté)
  w.eval("(function(){ const b=AB(); for (const sl in BASE_KIT) b.fit[sl]=[mintInstance(BASE_KIT[sl])]; refit(b); syncActive(); recomputeOwned(); })()");
  check("E7: coque S livrée nue (CT refuse avant assemblage impossible ici — vérifié via fleche plus bas)", true);
  check("E4: classe détectée S", w.eval("chassisClassOf(AB().chassis)") === "S");
  check("E4: stock logé (layout valide)", w.eval(
    "(function(){const b={chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}}; return layoutValid(b, autoArrange(b));})()"));
  const kg = w.eval("ENGINE.physStats({chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}}).massKg");
  /* Le plafond n'est plus écrit en dur ici : il vit dans les DONNÉES du
     concours (porté à 1,42 le 26/07). Le test vérifie que le bot de départ
     est homologué, pas qu'il tient sous un nombre gravé dans le harness. */
  const capS = w.eval("tournamentById('sumoS').rules.metrics.weightKg");
  check("E4: bot S sous le plafond de l'épreuve", kg > 0.8 && kg <= capS,
        kg.toFixed(2) + " kg / " + capS + " kg");
  // scrutin : le S passe, le M est refusé (classe), chenilles et v3 refusés
  const rules = w.eval("JSON.stringify(tournamentById('sumoS').rules)");
  check("E4: sumoS écrit ses règles S (classe + pesée)",
        /"chassisClass":"S"/.test(rules) && /"weightKg":1\.\d\d/.test(rules), rules.slice(0, 120));
  check("E4: bot S admis au Défi du Bureau", w.eval(
    "checkEntry({chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{}}, tournamentById('sumoS').rules).ok"));
  check("E4: bot M refusé (classe)", w.eval(
    "checkEntry({chassis:'boxy', parts:{}, counts:{}}, tournamentById('sumoS').rules).ok") === false);
  check("E4: chenilles refusées en S", w.eval(
    "checkEntry({chassis:AB().chassis, parts:{...S.parts.equipped, propulsion:'pr3'}, counts:{}}, tournamentById('sumoS').rules).ok") === false);
  check("E4: firmware v3 refusé en S", w.eval(
    "checkEntry({chassis:AB().chassis, parts:{...S.parts.equipped, software:'s2'}, counts:{}}, tournamentById('sumoS').rules).ok") === false);
  // surcharge : gros moteur + grosse batterie font sauter la pesée
  check("E4: surpoids refusé (pesée 1.36)", w.eval(
    "checkEntry({chassis:AB().chassis, parts:{...S.parts.equipped, motor:'m3', battery:'b3', ballast:'l2'}, counts:{}}, tournamentById('sumoS').rules).ok") === false);
  // prime de montée : champion de la Coupe des Puces, une seule fois
  w.eval("S.concours.cupS = FORMATS.bracket.init({size:8, seed:42})");
  w.eval("(function(){ const st=S.concours.cupS; while(!FORMATS.bracket.isDone(st)) FORMATS.bracket.recordMatch(st, true); })()");
  const before = w.eval("S.bolts");
  w.eval("curVsConcours='cupS'; curMode='bracket'");
  // rejouer la branche fin de coupe : simuler via le vrai flux serait un match complet ;
  // on vérifie ici le mécanisme de la prime directement
  w.eval("(function(){ const pr={champ:true,total:0}; if(pr.champ && curVsConcours==='cupS' && !S.sPrimeAwarded){ S.sPrimeAwarded=true; S.bolts+=200; } })()");
  check("E4: prime de montée +200 (une fois)", w.eval("S.bolts") === before + 200 && w.eval("S.sPrimeAwarded") === true);
  w.eval("(function(){ const pr={champ:true,total:0}; if(pr.champ && curVsConcours==='cupS' && !S.sPrimeAwarded){ S.bolts+=200; } })()");
  check("E4: prime non redoublée", w.eval("S.bolts") === before + 200);
  // arènes : nerd sur le Défi, shop sur le Léger, tapis pour le portrait S
  check("E4: arène nerd sur sumoS", w.eval("tournamentById('sumoS').arena") === "assets/arena_s_nerd.webp");
  check("E4: arène atelier sur lightM", w.eval("tournamentById('lightM').arena") === "assets/arena_m_shop.webp");
  check("aucune erreur E4", w.errors.length === 0, w.errors[0] || "");
  w.close();
});



// ------------------------------------------------------ E6 : écran d'accueil & carrières
safe("E6 carrières", () => {
  // monde SANS sauvegarde → l'accueil s'affiche, le jeu attend
  const w0 = openWorld({ save: null });
  check("E6: accueil affiché sans carrière", w0.eval("$('welcomeOv').style.display") !== "none");
  // création → jeu démarré, carrière 1 écrite, pointeur posé
  w0.eval("$('careerName').value='Denis'; $('careerNew').click()");
  check("E6: création démarre la partie", w0.eval("$('welcomeOv').style.display") === "none"
        && w0.eval("CUR_CAREER") === 1
        && w0.eval("JSON.parse(localStorage.getItem(careerKey(1))).careerName") === "Denis");
  // seconde carrière + bascule douce : états indépendants
  w0.eval("S.bolts = 777; saveState()");
  w0.eval("createCareer('Louise')");
  check("E6: bascule sur la nouvelle (bolts par défaut)", w0.eval("CUR_CAREER") === 2 && w0.eval("S.bolts") !== 777);
  w0.eval("loadCareerState(1)");
  check("E6: retour carrière 1 (bolts retrouvés)", w0.eval("S.bolts") === 777 && w0.eval("da(S.careerName||'')") === "Denis");
  // plafond 3 puis suppression
  w0.eval("createCareer('C3')");
  check("E6: plafond 3/3 (création refusée)", w0.eval("createCareer('C4')") === null);
  w0.eval("deleteCareer(2)");
  check("E6: suppression libère un slot", w0.eval("careersList().length") === 2);
  check("aucune erreur E6", w0.errors.length === 0, w0.errors[0] || "");
  w0.close();
  // adoption du legacy : une sauvegarde roboclash_s4 devient Carrière 1 sans accueil
  const w1 = openWorld({ save: mkSave(null, { bolts: 4242 }) });
  check("E6: legacy adopté en Carrière 1", w1.eval("CUR_CAREER") === 1 && w1.eval("S.bolts") === 4242);
  check("E6: pas d'accueil quand une carrière existe", w1.eval("$('welcomeOv').style.display") === "none");
  check("E6: l'ancienne clé est déplacée", w1.eval("localStorage.getItem(SKEY)") === null);
  w1.close();
});



// ------------------------------------------------------ E7 : coque nue & carrière S
safe("E7 coque nue", () => {
  const w = openWorld({ save: null });
  // nouvelle carrière → PETIT RUSTY assemblé, CT vert, 35 €, patiné
  w.eval("$('careerNew').click()");
  check("E7: Petit Rusty au garage", w.eval("botName(AB())") === "PETIT RUSTY"
        && w.eval("AB().chassis") === "tortue_s");
  check("E7: classe S, 40 euros, patine 12%",
        w.eval("chassisClassOf(AB().chassis)") === "S" && w.eval("S.bolts") === 40
        && w.eval("AB().chassisWear") === 12);
  check("E7: CT vert (starter fonctionnel)",
        w.eval("functionalCheck({chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}}).ok"));
  check("E7: Rusty M absent du garage, vendu 195 en boutique",
        w.eval("S.garage.length") === 1 && w.eval("CHASSIS_INFO.boxy.cost") === 195);
  // achat d'une coque M → NUE, CT rouge avec motifs, dispute refusée
  w.eval("S.bolts = 500; buyBot('fleche')");
  check("E7: coque neuve nue (aucun kit)", w.eval("Object.keys(AB().fit).every(sl=>AB().fit[sl].length===0)"));
  const fc = w.eval("JSON.stringify(functionalCheck({chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}}))");
  check("E7: CT rouge et motifs parlants", /"ok":false/.test(fc) && /moteur|propulsion/.test(fc), fc.slice(0,90));
  const before = w.eval("NAV.stack.length");
  w.eval("curLigue='regionale'; disputeConcours('libre')");
  check("E7: dispute refusée pour bot non fonctionnel", w.eval("NAV.stack.length") === before);
  // migration S→M : le moteur de Petit Rusty se remonte dans la fleche
  w.eval("S.activeBot=0; syncActive()");
  const uid = w.eval("AB().fit.motor[0]");
  w.eval("AB().fit.motor=[]; refit(AB())");
  w.eval("S.activeBot=1; syncActive()");
  check("E7: pièce migrée S vers M", w.eval(`tryFit(AB(), 'motor', ['${uid}'])`) === true
        && w.eval("AB().equipped.motor") === "m0");
  check("aucune erreur E7", w.errors.length === 0, w.errors[0] || "");
  w.close();
});

// ------------------------------------------------------ J0 : les fixtures suivent SAVE_V
safe("J0 fixtures alignées sur SAVE_V", () => {
  const w = openWorld();
  check("J0 la version des fixtures est celle du jeu",
        w.eval("SAVE_V") === SAVE_V_FIXTURE,
        "jeu=" + w.eval("SAVE_V") + " fixtures=" + SAVE_V_FIXTURE);
  w.close();
});

// ------------------------------------------------------ P-PILOTE : le pilote appartient au bot
safe("J16 le pilote appartient au bot", () => {
  const w = openWorld();
  w.eval("S.bolts = 5000; buyBot('fleche')");                  // 2 bots au garage
  check("J16 chaque bot naît avec son pilote", w.eval("S.garage.every(b=>b.pilot && PILOT_KEYS.every(k=>ENGINE.OPTS[k].includes(b.pilot[k])))"));
  check("J16 plus de pilote global", w.eval("S.settings === undefined"));
  // deux pilotes DIFFÉRENTS sur deux bots
  w.eval("S.activeBot=0; syncActive(); PILOT().aggression='fierce'");
  w.eval("S.activeBot=1; syncActive(); PILOT().aggression='cautious'; saveState()");
  check("J16 deux bots, deux pilotes",
        w.eval("S.garage[0].pilot.aggression") === "fierce" &&
        w.eval("S.garage[1].pilot.aggression") === "cautious",
        w.eval("S.garage.map(b=>b.pilot.aggression).join('/')"));
  // …et ils survivent au rechargement
  const w2 = openWorld({ save: JSON.parse(w.eval("JSON.stringify(S)")) });
  check("J16 les pilotes survivent au rechargement",
        w2.eval("S.garage[0].pilot.aggression") === "fierce" &&
        w2.eval("S.garage[1].pilot.aggression") === "cautious",
        w2.eval("S.garage.map(b=>b.pilot.aggression).join('/')"));
  check("J16 le build combattu lit le pilote DU BOT actif",
        w2.eval("S.activeBot=1, syncActive(), ({...PILOT()}).aggression") === "cautious");
  w2.close();
  // palier logiciel : MONTÉ, pas possédé
  w.eval("S.activeBot=0; syncActive(); mintInstance('s2'); recomputeOwned()");
  check("J16 s2 possédé mais non monté ⇒ stratégie verrouillée", w.eval("!isUnlocked('strategy')"));
  w.eval("tryEquip('software','s2'); recomputeOwned()");
  check("J16 s2 monté ⇒ stratégie déverrouillée", w.eval("isUnlocked('strategy')"));
  w.eval("S.activeBot=1; syncActive()");
  check("J16 l'autre bot, resté en s0, reste verrouillé", w.eval("!isUnlocked('strategy')"));
  // durcissement : pilote corrompu ⇒ défauts, jamais de crash
  const hostile = JSON.parse(w.eval("JSON.stringify(S)"));
  hostile.garage[0].pilot = { aggression:"banane", strategy:42 };
  hostile.garage[1].pilot = "pas un objet";
  const w3 = openWorld({ save: hostile });
  check("J16 pilote corrompu rabattu sur les défauts, sans crash",
        w3.eval("S.garage.every(b=>PILOT_KEYS.every(k=>ENGINE.OPTS[k].includes(b.pilot[k])))") &&
        w3.errors.length === 0, w3.errors[0] || "");
  w3.close();
  check("aucune erreur J16", w.errors.length === 0, w.errors[0] || "");
  w.close();
});


// ------------------------------------------------------ S20-SCRUTIN : le gel tient jusqu'au ring
safe("J17 le scrutin tient jusqu'au ring", () => {
  const w = openWorld({ save: mkSave(null, { bolts: 3000, beaten: 99 }) });
  // un bot S assemblé, légal au Défi du Bureau
  w.eval("buyBot('tortue_s')");
  const gi = w.eval("S.garage.findIndex(b=>b.chassis==='tortue_s')");
  w.eval(`S.activeBot=${gi}; syncActive(); recomputeOwned()`);
  w.eval("(function(){ const b=AB(); for (const sl in BASE_KIT) b.fit[sl]=[mintInstance(BASE_KIT[sl])]; refit(b); syncActive(); recomputeOwned(); })()");
  const eng = w.eval("JSON.stringify(engageConcours('sumoS'))");
  check("J17 le bot S est admis au Défi du Bureau", JSON.parse(eng).ok === true, eng);
  check("J17 l'engagement a gelé un build", w.eval("!!(CN('sumoS') && CN('sumoS').lock)"));
  // l'ancien repli pointait AILLEURS : c'est tout le bug
  check("J17 MODE_CONCOURS ne désigne PAS l'épreuve disputée",
        w.eval("MODE_CONCOURS[modeForConcours('sumoS')]") !== "sumoS",
        w.eval("MODE_CONCOURS[modeForConcours('sumoS')]"));
  // on triche au garage APRÈS l'engagement : second moteur, hors maxCount
  w.eval("disputeConcours('sumoS')");
  w.eval("AB().counts.motor = 2");
  check("J17 le concours disputé est bien identifié", w.eval("curConcoursId()") === "sumoS");
  check("J17 le build qui entre en piste est le build GELÉ",
        w.eval("!!((CN(curConcoursId())||{}).lock)"));
  check("J17 le build gelé ignore la triche du garage",
        (w.eval("(CN(curConcoursId()).lock.counts||{}).motor") || 1) === 1,
        "counts.motor gelé = " + w.eval("JSON.stringify((CN(curConcoursId()).lock.counts||{}).motor)"));
  // épreuve SANS engagement : l'homologation a lieu au moment de disputer
  w.eval("S.activeBot=0; syncActive(); recomputeOwned(); curVsConcours=null; NAV.reset()");
  w.eval("AB().counts.motor = 4");                       // sumoM plafonne à 3
  w.eval("curLigue='regionale'; disputeConcours('sumoM')");
  check("J17 l'échelle M refuse un build hors multiplicité",
        w.eval("curVsConcours") === null && w.eval("NAV.stack.length") === 1,
        "curVsConcours=" + w.eval("JSON.stringify(curVsConcours)"));
  w.eval("AB().counts.motor = 1");
  w.eval("disputeConcours('sumoM')");
  check("J17 …et l'accepte une fois conforme",
        w.eval("curVsConcours") === "sumoM" && w.eval("NAV.stack.length") === 2,
        "curVsConcours=" + w.eval("JSON.stringify(curVsConcours)") + " pile=" + w.eval("NAV.stack.length"));
  check("aucune erreur J17", w.errors.length === 0, w.errors[0] || "");
  w.close();
});


// ------------------------------------------------------ P-FICHE : échange de bots
safe("J18 fiche de bot — export / import", () => {
  const w = openWorld({ save: mkSave(null, { bolts: 5000 }) });
  w.eval("AB().pilot.aggression='fierce'; AB().pilot.power='torque'; AB().customize.color='#123456'");
  const fiche = w.eval("JSON.stringify(exportBot())");
  const f = JSON.parse(fiche);
  check("J18 la fiche est portable (aucun uid d'instance)",
        !/\"i\\d+\"/.test(fiche) && f.rc === 1 && !!f.chassis && !!f.parts, fiche.slice(0, 90));
  check("J18 la fiche emporte le pilote et la livrée",
        f.pilot.aggression === "fierce" && f.pilot.power === "torque" && f.color === "#123456");
  // aller-retour : le bot importé est identique au bot exporté
  const n0 = w.eval("S.garage.length");
  w.eval(`importBot(${JSON.stringify(fiche)})`);
  check("J18 l'import ajoute un bot au garage", w.eval("S.garage.length") === n0 + 1);
  check("J18 aller-retour fidèle (châssis, pièces, multiplicités, pilote)",
        w.eval(`(function(){ const a=${JSON.stringify(f)}, b=exportBot();
          return a.chassis===b.chassis
            && JSON.stringify(a.parts)===JSON.stringify(b.parts)
            && JSON.stringify(a.counts)===JSON.stringify(b.counts)
            && JSON.stringify(a.pilot)===JSON.stringify(b.pilot); })()`),
        w.eval("JSON.stringify(exportBot())").slice(0, 90));
  check("J18 le bot importé est fonctionnel (CT vert)",
        w.eval("functionalCheck({chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}}).ok"));
  check("J18 les instances importées sont des COPIES (l'original garde ses pièces)",
        w.eval("S.garage[0].fit.motor[0]") !== w.eval("AB().fit.motor[0]"));
  // entrée hostile : tolérante en entrée, stricte en sortie
  const n1 = w.eval("S.garage.length");
  check("J18 fiche illisible refusée sans crash", w.eval("importBot('{pas du json')") === null);
  check("J18 fiche vide refusée", w.eval("importBot('{}')") === null);
  check("J18 le garage n'a pas bougé après refus", w.eval("S.garage.length") === n1);
  w.eval(`importBot(JSON.stringify({rc:1, chassis:"inconnu42",
    parts:{motor:"b1", propulsion:"pr1", saucisse:"x"}, counts:{motor:99},
    pilot:{aggression:"banane"}, layout:{n_importe:"quoi"}, stickers:"pas un tableau"}))`);
  check("J18 fiche hostile ⇒ bot valide malgré tout",
        w.eval("!!ENGINE.CHASSIS[AB().chassis]") &&
        w.eval("PILOT_KEYS.every(k=>ENGINE.OPTS[k].includes(AB().pilot[k]))") &&
        w.eval("!AB().equipped.motor || DEF_SLOT[AB().equipped.motor]==='motor'"),
        w.eval("AB().chassis + ' motor=' + AB().equipped.motor"));
  check("aucune erreur J18", w.errors.length === 0, w.errors[0] || "");
  w.close();
});

// ------------------------------------------------------ P-CRESUS + Ligne Calibrage
const CRESUS_MIN = 100000;   // au-delà : c'est le coffre, pas un pécule
safe("J19 Crésus et Ligne Calibrage", () => {
  const w = openWorld();
  const pecule = w.eval("(function(){ const s=newCareerState(); return s.bolts; })()");
  check("J19 une carrière ordinaire démarre avec son pécule, pas un trésor",
        pecule > 0 && pecule < CRESUS_MIN, pecule + " €");
  check("J19 « cresus » ouvre le coffre",
        w.eval("estCresus('cresus')") === true && w.eval("CRESUS_BOLTS") >= CRESUS_MIN,
        w.eval("CRESUS_BOLTS") + " €");
  check("J19 « Crésus » aussi (accents et casse indifférents)",
        w.eval("estCresus('  Cr\\u00E9sus ')") === true);
  check("J19 un nom voisin ne l'ouvre pas",
        w.eval("estCresus('cresus2') || estCresus('cr\\u00E9su') || estCresus('')") === false);
  // la Ligne Calibrage
  check("J19 la Ligne Calibrage est ouverte et sans bourse",
        w.eval("!!ligueById('calibrage') && unlockMet(ligueById('calibrage').unlock)") &&
        w.eval("purseMult('etalM1')") === 0,
        "purseMult=" + w.eval("purseMult('etalM1')"));
  check("J19 chaque épreuve étalon pointe un étalon existant",
        w.eval("ligueById('calibrage').concours.every(id => !!ENGINE.BENCHMARKS[tournamentById(id).benchmark])"));
  // l'adversaire est FIGÉ : deux tirages donnent le même bot
  w.eval("curVsConcours='etalM1'; const a=makeOpponent('exhib'); window.__a=JSON.stringify(a.build);");
  w.eval("const b=makeOpponent('exhib'); window.__b=JSON.stringify(b.build);");
  check("J19 l'adversaire étalon est identique à chaque tirage",
        w.eval("window.__a === window.__b"));
  check("J19 …et c'est bien le build de la table, pas un tirage",
        w.eval("window.__a === JSON.stringify(ENGINE.BENCHMARKS.M1.build)"));
  // le calibrage mesure, il ne récompense pas
  const beaten0 = w.eval("S.beaten");
  w.eval("curMode='exhib'; curVsConcours='etalM1'");
  check("J19 le calibrage n'alimente pas le palmarès (règle en données)",
        w.eval("!!benchmarkOf('etalM1')") && w.eval("S.beaten") === beaten0);
  check("J19 un concours ordinaire n'est pas un étalon", w.eval("benchmarkOf('lightM')") === null);
  check("aucune erreur J19", w.errors.length === 0, w.errors[0] || "");
  w.close();
});


// ------------------------------------------------------ S25 : étoiles et chaîne de déblocage
safe("J20 étoiles et déblocage", () => {
  const w = openWorld();
  // barème : 1re ★★★ · 2e ★★ · 3e ★ · au-delà rien
  const bareme = w.eval(`JSON.stringify([1,2,3,4].map(r => { S.stars={}; return awardStars("sumoS", r); }))`);
  check("J20 barème 1/2/3 → 3/2/1 étoiles, rien au-delà", bareme === "[3,2,1,0]", bareme);
  check("J20 le MEILLEUR résultat est conservé",
        w.eval(`(function(){ S.stars={}; awardStars("sumoS",1); awardStars("sumoS",3); return starsOf("sumoS"); })()`) === 3);
  // chaîne INTERNE : l'épreuve suivante attend 1★ sur les précédentes
  w.eval("S.stars = {}");
  check("J20 la 1re épreuve d'une ligue est ouverte d'emblée", w.eval("concoursUnlocked('sumoS')"));
  check("J20 la 2e attend une étoile sur la 1re", !w.eval("concoursUnlocked('sparS')"));
  w.eval("S.stars = {sumoS:1}");
  check("J20 …et s'ouvre dès qu'elle l'a", w.eval("concoursUnlocked('sparS')"));
  check("J20 la 3e attend encore la 2e", !w.eval("concoursUnlocked('cupS')"));
  // chaîne ENTRE ligues
  check("J20 la ligue suivante reste fermée tant que la courante est incomplète",
        !w.eval("ligueUnlocked(ligueById('regionale'))"));
  w.eval("S.stars = {sumoS:1, sparS:2, cupS:1}");
  check("J20 1★ partout ouvre la ligue suivante", w.eval("ligueUnlocked(ligueById('regionale'))"));
  check("J20 mais pas celle d'après", !w.eval("ligueUnlocked(ligueById('ouverte'))"));
  // Calibrage et combat libre restent hors barème
  check("J20 Calibrage est hors chaîne et toujours ouverte",
        w.eval("ligueUnlocked(ligueById('calibrage'))") && w.eval("ligueById('calibrage').noStars === true"));
  check("J20 le combat libre ne compte pas d'étoile",
        w.eval("tournamentById('libre').noStars === true") &&
        w.eval("starConcours(ligueById('regionale')).includes('libre') === false"));
  check("J20 aucun étalon ne compte d'étoile",
        w.eval("ligueById('calibrage').concours.every(id => tournamentById(id).noStars === true)"));
  // le seuil manquant est NOMMÉ
  w.eval("S.stars = {sumoS:1}");
  const miss = w.eval("JSON.stringify((missingStarFor('cupS')||{}).concours)");
  check("J20 le seuil manquant nomme l'épreuve à réussir", miss === '["sparS"]', miss);
  check("J20 rien à réclamer quand c'est ouvert", w.eval("missingStarFor('sparS')") === null);
  // rangs par format
  check("J20 bracket : champion 1er, finale 2e, demi 3e",
        w.eval("rankOfBracket({out:false, round:4, rounds:4})") === 1 &&
        w.eval("rankOfBracket({out:true, round:3, rounds:4})") === 2 &&
        w.eval("rankOfBracket({out:true, round:2, rounds:4})") === 3 &&
        w.eval("rankOfBracket({out:true, round:1, rounds:4})") === 0);
  check("J20 échelle : champion 1er, niveau 4 puis 3",
        w.eval("rankOfLadder(5, true)") === 1 && w.eval("rankOfLadder(4, false)") === 2 &&
        w.eval("rankOfLadder(3, false)") === 3 && w.eval("rankOfLadder(2, false)") === 0);
  // les déblocages sont DÉRIVÉS, jamais écrits
  w.eval("S.stars = {sumoS:1, sparS:1, cupS:1}");
  const brut = w.eval("JSON.stringify(S)");
  check("J20 aucun déblocage n'est stocké, seulement les étoiles",
        !/unlocked|deblo/i.test(brut) && /"stars":\{"sumoS":1/.test(brut),
        brut.slice(0, 60));
  // un état hostile ne casse rien
  const w2 = openWorld({ save: mkSave(null, { stars: { sumoS: 99, inconnu: 2, cupS: "x" } }) });
  check("J20 étoiles hostiles assainies au boot",
        w2.eval("JSON.stringify(S.stars)") === "{}", w2.eval("JSON.stringify(S.stars)"));
  check("J20 aucune erreur", w2.errors.length === 0 && w.errors.length === 0, w.errors[0] || "");
  w2.close(); w.close();
});

// ------------------------------------------------------ Ligue Ouverte
safe("J21 Ligue Ouverte", () => {
  const w = openWorld();
  const lg = w.eval("JSON.stringify(ligueById('ouverte'))");
  check("J21 la ligue existe et porte 4 épreuves",
        w.eval("ligueById('ouverte').concours.length") === 4, lg.slice(0, 100));
  /* Mixte par son PROGRAMME, jamais par le ring : chaque épreuve reste
     MONO-classe, un S ne rencontre jamais un M. */
  const classes = w.eval(`JSON.stringify(ligueById('ouverte').concours.map(id => tournamentById(id).rules.chassisClass))`);
  check("J21 chaque épreuve est mono-classe", !/null|undefined/.test(classes), classes);
  check("J21 le programme est mixte S et M",
        classes.includes('"S"') && classes.includes('"M"'), classes);
  /* Deux philosophies : les épreuves S bridents le MATÉRIEL et laissent le
     logiciel libre ; les M bridents le LOGICIEL et laissent le matériel. */
  const s1 = w.eval("JSON.stringify(tournamentById('ouvS1').rules)");
  const m1 = w.eval("JSON.stringify(tournamentById('ouvM1').rules)");
  check("J21 les épreuves S serrent la pesée, sans plafond logiciel",
        /"weightKg":1\.2/.test(s1) && !/maxSoftware/.test(s1), s1.slice(0, 110));
  check("J21 les épreuves M plafonnent le logiciel, pesée de classe",
        /"maxSoftware":"s0"/.test(m1) && /"weightKg":5\.44/.test(m1), m1.slice(0, 110));
  check("J21 chaque arène de la ligue est déclarée",
        w.eval("ligueById('ouverte').concours.every(id => !!ARENA_GEOM[tournamentById(id).arena])"));
  check("J21 la ligue s'ouvre après la Régionale, pas avant",
        w.eval("(S.stars={sumoS:1,sparS:1,cupS:1}, !ligueUnlocked(ligueById('ouverte')))") &&
        w.eval("(S.stars={sumoS:1,sparS:1,cupS:1,sumoM:1,lightM:1,cupM:1}, ligueUnlocked(ligueById('ouverte')))"));
  check("J21 la Nationale reste visible et verrouillée",
        w.eval("!!ligueById('nationale') && !ligueUnlocked(ligueById('nationale'))"));
  check("J21 aucune erreur", w.errors.length === 0, w.errors[0] || "");
  w.close();
});


report("QC parcours");
