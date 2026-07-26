/* data.js — données statiques pures : i18n, sprites, taxonomie.
   Chargé avant engine.js et app.js ; ne référence aucun des deux.
   (A3 y déplacera les registres châssis/pièces unifiés.) */
const STRINGS = {
  fr: {
    yourBot:"Ton bot — RUSTY", machine:"Machine", fight:"COMBAT !",
    forfeit:"Forfait", settings:"Réglages", nextOpp:"Adversaire suivant", retry:"Revanche",
    level:"Niveau", champion:"CHAMPION",
    strategy:"Stratégie", adaptive:"Adaptatif", pressure:"Pression", counter:"Contre", ambush:"Embuscade",
    aggression:"Agressivité", edgeGuard:"Garde au bord",
    approach:"Approche", power:"Puissance", chargeDist:"Dist. de charge", handling:"Conduite",
    cautious:"Prudent", balanced:"Équilibré", fierce:"Féroce",
    daredevil:"Casse-cou", normal:"Normale", fearful:"Peureuse",
    frontal:"Frontal", flank:"Flanc", opportunist:"Opportun.",
    speed:"Vitesse", mixed:"Mixte", torque:"Couple",
    short:"Courte", medium:"Moyenne", long:"Longue",
    stable:"Stable", nervous:"Nerveuse", drift:"Dérive",
    stSpeed:"Vitesse", stPush:"Poussée", stLeverage:"Prise", stTraction:"Traction", stEnergy:"Énergie",
    lockWin1:"🔒 Approche — débloquée à la 1ʳᵉ victoire",
    lockWin3:"🔒 Dist. de charge — débloquée après 3 victoires",
    lockWin5:"🔒 Conduite — débloquée après 5 victoires",
    unlockApproach:"Contrôleur recalibré : APPROCHE débloquée !",
    unlockCharge:"Contrôleur recalibré : DISTANCE DE CHARGE débloquée !",
    unlockHandling:"Contrôleur recalibré : CONDUITE débloquée !",
    win:"VICTOIRE !", lose:"DÉFAITE",
    duelsWon:"Duels de prise : Toi {a} — {b} Lui",
    forfeited:"Forfait — fin simulée.",
    tabFight:"Championnats", tabWorkshop:"Garage", tabShop:"Boutique",
    editReset:"Auto-arranger", layAll:"Tout", cgShow:"CG", cgHide:"CG ✓",
    persoColor:"Couleur du châssis", persoSticker:"Stickers", stickerNone:"Aucun",
    noRoom:"Pas de place dans le châssis ! Libérez de l'espace ou attendez un châssis plus grand.",
    stickerShopHint:"Achetez des stickers dans la boutique !", stickerOwned:"Acheté ✓",
    stickerPlace:"Poser (tape = +1)", stickerRemove:"Retirer du robot", layStickers:"Stickers",
    stickerDragHint:"Glisse un sticker hors du châssis pour le retirer.", hbShow:"Hitbox", hbHide:"Hitbox ✓",
    lay_chassis:"Châssis", lay_internal:"Interne", lay_armor:"Blindage", lay_external:"Externe",
    equip:"Équiper", equipped:"Équipé ✓", stock:"d'origine", buyGo:"Acheter",
    notOwned:"Boutique", weldedChassis:"Châssis soudé — RUSTY (boxy). Remplaçable un jour…",
    noneAvail:"aucune disponible (règles sumo)",
    slot_chassis:"Châssis", slot_propulsion:"Propulsion", slot_motor:"Moteur",
    slot_cpu:"CPU", slot_battery:"Batterie", slot_armor:"Blindage & prise",
    slot_weapon1:"Arme principale", slot_weapon2:"Arme secondaire",
    slot_software:"Software", slot_ballast:"Lest", slot_sensors:"Capteurs",
    slot_srimech:"Srimech", slot_cooling:"Refroidissement",
    ndWeight:"Poids", ndPower:"Puissance", ndTorque:"Couple", ndBattery:"Batterie",
    mode_stalk:"rôde", mode_charge:"CHARGE !", mode_recenter:"au centre !",
    mode_orbit:"orbite", mode_hold:"à l'affût", mode_escape:"FUITE !", domLabel:"Dominé !",
    fx_interval:"réflexion", fx_gain:"servo", fx_noise:"visée", fx_sr:"redressement",
    fx_drain:"conso", fx_edgePush:"pousse vers le bord",
    pn_m0:"Bobinage fatigué", pn_m1:"Twin 540", pn_m2:"Vector Brushless",
    pn_m3:"KV90 Couple-Monstre", pn_m4:"KV600 Sprint",
    pn_b0:"Pack gonflé", pn_b1:"LiPo 4S", pn_b2:"LiPo 4S HD", pn_b3:"Brique graphène",
    pn_pr0:"Deux roues + patins", pn_pr1:"4×4 crampons", pn_pr2:"Triporteur sport", pn_pr3:"Chenilles acier",
    garageTitle:"Garage", botBought:"{name} acheté !", onOtherBot:"{n} sur un autre bot",
    scrClass:"Classe {c} requise (ton bot est {got})", scrTracks:"Chenilles interdites",
    scrWeapons:"Armes interdites", scrBanned:"{p} interdit", scrSoftware:"Software max v{v}",
    scrMetric:"{m} {v}{u} > max {c}{u}", scrPass:"Éligible", scrFail:"Non éligible", shopUsed:"Occasions du jour", usedWear:"usure {w} %", usedSold:"Vendu", scrTier:"Palier {tr} requis", scrCount:"{p} ×{n} > max ×{c}", dbTitle:"Débriefing", dbBattery:"Batterie restante", dbDist:"Distance parcourue", dbContact:"Temps au contact", dbFlipped:"Temps retourné", endShrinkOut:"mort subite (piste rétrécie)", endRingOut:"sortie de piste", endKoFlip:"KO retourné", tournaments:"Tournois", unlimited:"Sans limite", soon:"Bientôt jouable", secLigues:"LIGUES", enter:"Entrer ›", lockedTag:"Verrouillée", newTag:"Nouveau", nConcours:"{n} concours", kEnCours:"{k} en cours", enCours:"en cours", engage:"S\u2019engager", abandon:"Abandonner", confirmAbandon:"Confirmer ?", dispute:"Disputer la manche", freeFight:"Combattre", youTag:"VOUS", foeTag:"ADVERSAIRE", vsBehaviour:"COMPORTEMENT \u00B7 CETTE MANCHE", mancheN:"MANCHE {r}/{n}", vsQual:"QUALIFICATION", vsExhib:"EXHIBITION", hudBattery:"BATT", hudHealth:"SANT\u00C9", stickVersions:"Plaques de version", stickerAuto:"Offerte \u00B7 logiciel", stickerWithSw:"Avec Logiciel {v}", lockBeaten:"Palmar\u00E8s : {n} victoires", lay_structure:"Structure", shopSerie:"S\u00E9rie", concoursOver:"Concours termin\u00E9 \u2014 r\u00E9engage-toi pour rejouer", introEyebrow:"CIRCUIT GARAGE", introTitle:"Bienvenue au garage", introBody:"Ton but : devenir champion de robot sumo.<br><br>Tu d\u00E9marres en classe <b>S</b> \u2014 les petits engins d\u2019\u00E9tabli, 1,36 kg maximum sur la balance. Gagne des manches au <b>Circuit Garage</b>, am\u00E9liore ton bot pi\u00E8ce par pi\u00E8ce, et d\u00E9croche la <b>Coupe des Puces</b> : la prime de mont\u00E9e t\u2019ouvrira les ligues M.<br><br>Un robot doit passer le <b>contr\u00F4le technique</b> pour combattre \u2014 le garage te dira toujours ce qui manque.", introGo:"C\u2019EST PARTI", recvEyebrow:"NOUVEAU CH\u00C2SSIS", recvGo:"AU GARAGE", recvStarterSub:"Ton premier robot \u2014 assembl\u00E9 sur un coin de bureau.", bareHullSub:"Coque nue \u2014 \u00E0 \u00E9quiper avant le CT.", usedRecvSub:"D\u2019occasion \u2014 assembl\u00E9, us\u00E9, pr\u00EAt \u00E0 rouler.", ctOk:"CT : FONCTIONNEL \u2713", addPart:"AJOUTER COMPOSANT", removePart:"RETIRER", invEmpty:"Inventaire vide \u2014 passe \u00E0 la boutique.", ct_propulsion:"CT : ce bot ne roule pas (propulsion manquante)", ct_motor:"CT : rien ne tourne (moteur manquant)", ct_battery:"CT : pas de jus (batterie manquante)", ct_cpu:"CT : personne aux commandes (CPU manquant)", ct_place:"CT : \u00E7a ne rentre pas sur la coque", bareHull:"{name} \u2014 coque nue livr\u00E9e au garage. \u00C0 \u00E9quiper !", welcomeEyebrow:"QUI PILOTE AUJOURD\u2019HUI ?", careerNew:"NOUVELLE CARRI\u00C8RE", careersBtn:"CARRI\u00C8RES", careerNamePh:"Nom de la carri\u00E8re", careerMeta:"Niveau {lv} \u00B7 {b} \u20AC \u00B7 {w} victoires", classe:"Classe", sPrime:"PRIME DE MONT\u00C9E \u00B7 +200 \u20AC \u2014 un sponsor t\u2019ouvre les ligues M !", lay_equipement:"\u00C9quipement", shopUsedBot:"Bot d\u2019occasion \u00B7 assembl\u00E9", dmgTitle:"D\u00E9g\u00E2ts subis", dmgNone:"Aucun d\u00E9g\u00E2t notable", dmgHS:"HS", dmgRipped:"ARRACH\u00C9", dmgChassis:"Ch\u00E2ssis", dmgRepairEst:"R\u00E9paration estim\u00E9e : {c} \u20AC", repair:"R\u00E9parer {c} \u20AC", repairAll:"Tout r\u00E9parer \u00B7 {c} \u20AC", wearPct:"usure {w} %", usedBotSold:"Vendu \u2014 nouvelle offre demain", usedBotBought:"{name} d\u2019occasion au garage \u2014 inspecte-le !", settingsTitle:"R\u00E9glages", settingsEyebrow:"ROBOCLASH \u00B7 PWA", moreCtrlHint:"Plus de contr\u00F4les disponibles apr\u00E8s am\u00E9lioration du software.", verRow_install:"Installable", verRow_maj:"Mises \u00E0 jour auto", setLang:"Langue", setVersions:"Versions", close:"Fermer", verOpenLegacy:"Ouvrir la version single-file", verRow_app:"", verRow_build:"Build", verRow_off:"Hors-ligne", verRow_save:"Sauvegarde", verSaveV4:"v4 instances", verSaveOld:"ancienne", scrap:"Jeter", botScrapped:"{name} d\u00E9moli \u2014 pi\u00E8ces retourn\u00E9es \u00E0 l\u2019inventaire", lastBot:"Impossible : dernier bot du garage", garageInv:"Inventaire \u00B7 pi\u00E8ces libres", invEmpty:"Aucune pi\u00E8ce libre \u2014 tout est mont\u00E9", invNew:"neuve", shopChassis:"Ch\u00E2ssis neufs", champRound:"Manche {r}/{n} · {rank}ᵉ", champTable:"Classement", you:"VOUS", bracketNext:"Qualifié · {r}", bracketChamp:"CHAMPION", bracketOut:"Éliminé", bracketPrize:"+{total} €", bracketTitle:"Coupe M", bracketDone:"terminée", champDone:"Saison terminée", champPrize:"{rank}ᵉ au classement · +{total} €", pn_a0:"(tôle nue)", pn_a1:"Pare-choc", pn_a2:"Lame acier", pn_a3:"Fourche",
    pn_c0:"8-bit récupéré", pn_c1:"Cortex M7", pn_c2:"Pod neuronal",
    pn_n0:"Pare-chocs", pn_n1:"IR 360°", pn_n2:"LIDAR",
    pn_s0:"Firmware v1", pn_s1:"Firmware v2 VectorPush", pn_s2:"Firmware v3 Escape",
    pn_l0:"(aucun)", pn_l1:"Gueuse 300 g", pn_l2:"Gueuse 600 g",
    pn_r0:"(aucun)", pn_r1:"Bras basculeur", pn_r2:"Piston CO₂",
    pn_k0:"Passif", pn_k1:"Ailettes alu", pn_k2:"Watercooling",
    pn_w0:"(arme 1 — vide)", pn_x0:"(arme 2 — vide)",
    styleLabel:"Ton style :",
    tend_charger:"Fonceur", tend_circler:"Contourneur", tend_camper:"Campeur",
    tend_pusher:"Bulldozer", tend_waiter:"Attentiste", tend_wild:"Imprévisible",
    classLight:"Léger", classMid:"Moyen", classHeavy:"Lourd",
    // causal debrief lines
    cause_edge:"Tu as passé trop de temps près du bord — il n'a eu qu'à finir le travail. Monte ta Garde au bord.",
    cause_dominated:"Il t'a dominé dans les corps-à-corps. Passe ta Conduite en Nerveuse pour mieux le contrer, monte l'Agressivité, ou change d'Approche.",
    cause_flip:"Retourné par un adversaire à forte prise. Un Srimech te relève vite (survie au flip), une Gueuse abaisse ton centre de gravité (plus dur à retourner).",
    cause_shrink:"Mort subite perdue : tu étais plus loin du centre quand l'arène s'est refermée. Garde le centre en fin de match.",
    cause_generic:"Poussé dehors. Regarde d'où venait la pression et ajuste un réglage à la fois.",
    win_flip:"Il s'est renversé sur ton impact — spectaculaire.",
    win_shrink:"Mort subite gagnée : tu tenais le centre au bon moment.",
    win_duels:"Tu as gagné les corps-à-corps — il patinait à chaque contact.",
    win_push:"Sorti proprement du cercle. Réglages payants.",
    championMsg:"RUSTY a tout gagné avec son vieux châssis. Le garage complet ouvre bientôt (slice 3) : nouveaux châssis, bots custom.",
    // slice 2
    garage:"Garage", buy:"Acheter", maxed:"MAX",
    upMotor:"Moteurs", upBattery:"Batterie", upTires:"Pneus", upPlow:"Lame avant",
    fxMotor:"+15 % Poussée, +7 % Vitesse", fxBattery:"+20 % Énergie",
    fxTires:"+10 % Traction & ancrage", fxPlow:"+0,3 Prise",
    bought:"{name} installé·e !",
    friendly:"Match amical",
    tourneyTitle:"TOURNOI NIVEAU {l} — Match {i}/3",
    tourneyPrize:"Prix : {p} € + badge + niveau {n}",
    tourneyChampPrize:"Prix : {p} € + badge + titre de CHAMPION",
    tourneyNext:"Match {i}/3 →", tourneyWon:"TOURNOI GAGNÉ !",
    tourneyLost:"Tournoi échoué — on repart au match 1. Le bracket ne change pas : tu le connais mieux maintenant.",
    tourneyReroll:"Tournoi échoué — nouveaux inscrits ! Un bracket tout frais t'attend.",
    oppRetired:"Il s'est retiré du circuit. Un nouvel adversaire arrive.",
    boltsEarned:"+{b} €",
    qualif:"Qualifications : {n}/2",
  },
  en: {
    yourBot:"Your bot — RUSTY", machine:"Machine", fight:"FIGHT!",
    forfeit:"Forfeit", settings:"Settings", nextOpp:"Next opponent", retry:"Rematch",
    level:"Level", champion:"CHAMPION",
    strategy:"Strategy", adaptive:"Adaptive", pressure:"Pressure", counter:"Counter", ambush:"Ambush",
    aggression:"Aggression", edgeGuard:"Edge guard",
    approach:"Approach", power:"Power", chargeDist:"Charge dist.", handling:"Handling",
    cautious:"Cautious", balanced:"Balanced", fierce:"Fierce",
    daredevil:"Daredevil", normal:"Normal", fearful:"Fearful",
    frontal:"Frontal", flank:"Flank", opportunist:"Opportun.",
    speed:"Speed", mixed:"Mixed", torque:"Torque",
    short:"Short", medium:"Medium", long:"Long",
    stable:"Stable", nervous:"Nervous", drift:"Drift",
    stSpeed:"Speed", stPush:"Push", stLeverage:"Leverage", stTraction:"Traction", stEnergy:"Energy",
    lockWin1:"🔒 Approach — unlocks at 1st win",
    lockWin3:"🔒 Charge dist. — unlocks after 3 wins",
    lockWin5:"🔒 Handling — unlocks after 5 wins",
    unlockApproach:"Controller recalibrated: APPROACH unlocked!",
    unlockCharge:"Controller recalibrated: CHARGE DISTANCE unlocked!",
    unlockHandling:"Controller recalibrated: HANDLING unlocked!",
    win:"VICTORY!", lose:"DEFEAT",
    duelsWon:"Leverage duels: You {a} — {b} Them",
    forfeited:"Forfeit — outcome simulated.",
    tabFight:"Championships", tabWorkshop:"Garage", tabShop:"Shop",
    editReset:"Auto-arrange", layAll:"All", cgShow:"CoG", cgHide:"CoG ✓",
    persoColor:"Chassis colour", persoSticker:"Stickers", stickerNone:"None",
    noRoom:"No room in the chassis! Free up space or wait for a bigger hull.",
    stickerShopHint:"Buy stickers in the shop!", stickerOwned:"Owned ✓",
    stickerPlace:"Place (tap = +1)", stickerRemove:"Remove from the bot", layStickers:"Stickers",
    stickerDragHint:"Drag a sticker off the hull to remove it.", hbShow:"Hitbox", hbHide:"Hitbox ✓",
    lay_chassis:"Chassis", lay_internal:"Internal", lay_armor:"Armor", lay_external:"External",
    equip:"Equip", equipped:"Equipped ✓", stock:"stock", buyGo:"Buy",
    notOwned:"Shop", weldedChassis:"Welded chassis — RUSTY (boxy). Replaceable someday…",
    noneAvail:"none available (sumo rules)",
    slot_chassis:"Chassis", slot_propulsion:"Propulsion", slot_motor:"Motor",
    slot_cpu:"CPU", slot_battery:"Battery", slot_armor:"Armor & leverage",
    slot_weapon1:"Main weapon", slot_weapon2:"Secondary weapon",
    slot_software:"Software", slot_ballast:"Ballast", slot_sensors:"Sensors",
    slot_srimech:"Srimech", slot_cooling:"Cooling",
    ndWeight:"Weight", ndPower:"Power", ndTorque:"Torque", ndBattery:"Battery",
    mode_stalk:"stalking", mode_charge:"CHARGE!", mode_recenter:"recenter!",
    mode_orbit:"orbiting", mode_hold:"lying in wait", mode_escape:"ESCAPE!", domLabel:"Dominated!",
    fx_interval:"planning", fx_gain:"servo", fx_noise:"aim", fx_sr:"self-right",
    fx_drain:"drain", fx_edgePush:"edge-push vectoring",
    pn_m0:"Tired windings", pn_m1:"Twin 540", pn_m2:"Vector Brushless",
    pn_m3:"KV90 Torque Monster", pn_m4:"KV600 Sprint",
    pn_b0:"Puffy pack", pn_b1:"LiPo 4S", pn_b2:"LiPo 4S HD", pn_b3:"Graphene brick",
    pn_pr0:"Two wheels + skids", pn_pr1:"4×4 lugs", pn_pr2:"Sport trike", pn_pr3:"Steel treads",
    garageTitle:"Garage", botBought:"{name} purchased!", onOtherBot:"{n} on another bot",
    scrClass:"Class {c} required (yours is {got})", scrTracks:"Tracks not allowed",
    scrWeapons:"Weapons not allowed", scrBanned:"{p} banned", scrSoftware:"Software max v{v}",
    scrMetric:"{m} {v}{u} > max {c}{u}", scrPass:"Eligible", scrFail:"Not eligible", shopUsed:"Today's used deals", usedWear:"{w}% wear", usedSold:"Sold", scrTier:"{tr} tier required", scrCount:"{p} ×{n} > max ×{c}", dbTitle:"Debrief", dbBattery:"Battery left", dbDist:"Distance covered", dbContact:"Contact time", dbFlipped:"Time flipped", endShrinkOut:"sudden death (shrinking floor)", endRingOut:"ring-out", endKoFlip:"KO (flipped)", tournaments:"Tournaments", unlimited:"No limit", soon:"Coming soon", secLigues:"LEAGUES", enter:"Enter ›", lockedTag:"Locked", newTag:"New", nConcours:"{n} events", kEnCours:"{k} ongoing", enCours:"ongoing", engage:"Enter event", abandon:"Withdraw", confirmAbandon:"Confirm?", dispute:"Play round", freeFight:"Fight", youTag:"YOU", foeTag:"FOE", vsBehaviour:"BEHAVIOUR \u00B7 THIS BOUT", mancheN:"ROUND {r}/{n}", vsQual:"QUALIFIER", vsExhib:"EXHIBITION", hudBattery:"BATT", hudHealth:"HP", stickVersions:"Version plates", stickerAuto:"Free \u00B7 software", stickerWithSw:"With Software {v}", lockBeaten:"Record: {n} wins", lay_structure:"Structure", shopSerie:"Series", concoursOver:"Event over \u2014 re-enter to play again", introEyebrow:"GARAGE CIRCUIT", introTitle:"Welcome to the garage", introBody:"Your goal: become a sumo robot champion.<br><br>You start in class <b>S</b> \u2014 benchtop bots, 1.36 kg max on the scale. Win bouts in the <b>Garage Circuit</b>, upgrade part by part, and take the <b>Flea Cup</b>: the promotion bonus opens the M leagues.<br><br>A robot must pass the <b>tech check</b> to fight \u2014 the garage always tells you what\u2019s missing.", introGo:"LET\u2019S GO", recvEyebrow:"NEW CHASSIS", recvGo:"TO THE GARAGE", recvStarterSub:"Your first robot \u2014 built on a desk corner.", bareHullSub:"Bare hull \u2014 equip it before the tech check.", usedRecvSub:"Second-hand \u2014 assembled, worn, ready to roll.", ctOk:"TECH CHECK: FUNCTIONAL \u2713", addPart:"ADD COMPONENT", removePart:"REMOVE", invEmpty:"Inventory empty \u2014 hit the shop.", ct_propulsion:"Tech check: no drive (propulsion missing)", ct_motor:"Tech check: nothing spins (motor missing)", ct_battery:"Tech check: no juice (battery missing)", ct_cpu:"Tech check: nobody home (CPU missing)", ct_place:"Tech check: parts don\u2019t fit the hull", bareHull:"{name} \u2014 bare hull delivered. Time to build!", welcomeEyebrow:"WHO\u2019S DRIVING TODAY?", careerNew:"NEW CAREER", careersBtn:"CAREERS", careerNamePh:"Career name", careerMeta:"Level {lv} \u00B7 {b} \u20AC \u00B7 {w} wins", classe:"Class", sPrime:"PROMOTION BONUS \u00B7 +200 \u20AC \u2014 a sponsor opens the M leagues!", lay_equipement:"Equipment", shopUsedBot:"Secondhand bot \u00B7 assembled", dmgTitle:"Damage report", dmgNone:"No notable damage", dmgHS:"DEAD", dmgRipped:"RIPPED OFF", dmgChassis:"Chassis", dmgRepairEst:"Repair estimate: {c} \u20AC", repair:"Repair {c} \u20AC", repairAll:"Repair all \u00B7 {c} \u20AC", wearPct:"wear {w} %", usedBotSold:"Sold \u2014 new offer tomorrow", usedBotBought:"Secondhand {name} in your garage \u2014 inspect it!", settingsTitle:"Settings", settingsEyebrow:"ROBOCLASH \u00B7 PWA", moreCtrlHint:"More controls unlock with software upgrades.", verRow_install:"Installable", verRow_maj:"Auto updates", setLang:"Language", setVersions:"Versions", close:"Close", verOpenLegacy:"Open the single-file version", verRow_app:"", verRow_build:"Build", verRow_off:"Offline", verRow_save:"Save format", verSaveV4:"v4 instances", verSaveOld:"legacy", scrap:"Scrap", botScrapped:"{name} scrapped \u2014 parts returned to inventory", lastBot:"Cannot scrap your last bot", garageInv:"Inventory \u00B7 free parts", invEmpty:"No free parts \u2014 everything is fitted", invNew:"new", shopChassis:"New chassis", champRound:"Round {r}/{n} · {rank}th", champTable:"Standings", you:"YOU", bracketNext:"Through · {r}", bracketChamp:"CHAMPION", bracketOut:"Eliminated", bracketPrize:"+{total} €", bracketTitle:"Cup M", bracketDone:"done", champDone:"Season over", champPrize:"{rank} in table · +{total} €", pn_a0:"(bare plate)", pn_a1:"Bumper", pn_a2:"Steel blade", pn_a3:"Fork",
    pn_c0:"Salvaged 8-bit", pn_c1:"Cortex M7", pn_c2:"Neural pod",
    pn_n0:"Bumpers", pn_n1:"IR 360°", pn_n2:"LIDAR",
    pn_s0:"Firmware v1", pn_s1:"Firmware v2 VectorPush", pn_s2:"Firmware v3 Escape",
    pn_l0:"(none)", pn_l1:"300 g slug", pn_l2:"600 g slug",
    pn_r0:"(none)", pn_r1:"Flipper arm", pn_r2:"CO₂ piston",
    pn_k0:"Passive", pn_k1:"Alu fins", pn_k2:"Watercooling",
    pn_w0:"(weapon 1 — empty)", pn_x0:"(weapon 2 — empty)",
    styleLabel:"Your style:",
    tend_charger:"Charger", tend_circler:"Circler", tend_camper:"Camper",
    tend_pusher:"Bulldozer", tend_waiter:"Waiter", tend_wild:"Wildcard",
    classLight:"Light", classMid:"Middle", classHeavy:"Heavy",
    cause_edge:"You spent too long near the edge — he only had to finish the job. Raise your Edge guard.",
    cause_dominated:"He dominated the clinches. Switch Handling to Nervous to counter, raise Aggression, or change your Approach.",
    cause_flip:"Flipped by a high-leverage foe. A Srimech self-rights you fast (survive the flip); a slug lowers your centre of gravity (harder to flip).",
    cause_shrink:"Lost sudden death: you were further from center when the arena closed. Hold the center late.",
    cause_generic:"Pushed out. Watch where the pressure came from and change one setting at a time.",
    win_flip:"He flipped on your impact — spectacular.",
    win_shrink:"Sudden death won: you held the center when it mattered.",
    win_duels:"You won the grapples — he was skidding on every contact.",
    win_push:"Clean ring out. Settings paid off.",
    championMsg:"RUSTY won it all with his old chassis. The full garage opens soon (slice 3): new chassis, custom bots.",
    // slice 2
    garage:"Garage", buy:"Buy", maxed:"MAX",
    upMotor:"Motors", upBattery:"Battery", upTires:"Tires", upPlow:"Front plow",
    fxMotor:"+15% Push, +7% Speed", fxBattery:"+20% Energy",
    fxTires:"+10% Traction & anchor", fxPlow:"+0.3 Leverage",
    bought:"{name} installed!",
    friendly:"Friendly match",
    tourneyTitle:"LEVEL {l} TOURNAMENT — Match {i}/3",
    tourneyPrize:"Prize: {p} € + badge + level {n}",
    tourneyChampPrize:"Prize: {p} € + badge + CHAMPION title",
    tourneyNext:"Match {i}/3 →", tourneyWon:"TOURNAMENT WON!",
    tourneyLost:"Tournament failed — back to match 1. Same bracket: you know it better now.",
    tourneyReroll:"Tournament failed — new entrants! A fresh bracket awaits.",
    oppRetired:"He retired from the circuit. A new opponent steps in.",
    boltsEarned:"+{b} €",
    qualif:"Qualifiers: {n}/2",
  }
};

const FLECHE_SRC="assets/fleche.webp";
const MARTEAU_SRC="assets/marteau.webp";
const TORTUE_SRC="assets/tortue.webp";
const LOSANGE_SRC="assets/losange.webp";
const DISQUE_SRC="assets/disque.webp";
const ARENA_SRC="assets/arena.webp";

// ---- sprites châssis / composants / armures (data pures) ----
const RUSTY_SPRITE_SRC = "assets/rusty_sprite.webp";



const COMPONENT_SPRITES = {
  motor:{"m0":{src:"assets/m0.webp",w:120,h:101},"m1":{src:"assets/m1.webp",w:128,h:107},"m2":{src:"assets/m2.webp",w:128,h:100},"m3":{src:"assets/m3.webp",w:192,h:110},"m4":{src:"assets/m4.webp",w:192,h:156}},
  battery:{"b0":{src:"assets/b0.webp",w:128,h:75},"b1":{src:"assets/b1.webp",w:128,h:100},"b2":{src:"assets/b2.webp",w:256,h:129},"b3":{src:"assets/b3.webp",w:320,h:169}},
  srimech:{"r1":{src:"assets/r1.webp",w:118,h:128},"r2":{src:"assets/r2.webp",w:192,h:113}},
  cooling:{"k0":{src:"assets/k0.webp",w:119,h:120},"k1":{src:"assets/k1.webp",w:128,h:106},"k2":{src:"assets/k2.webp",w:188,h:192}},
  propulsion:{"pr0":{src:"assets/pr0.webp",w:95,h:128},"pr1":{src:"assets/pr1.webp",w:106,h:256},"pr2":{src:"assets/pr2.webp",w:149,h:192},"pr3":{src:"assets/pr3.webp",w:110,h:320}},
  cpu:{"c0":{src:"assets/c0.webp",w:106,h:120},"c1":{src:"assets/c1.webp",w:109,h:120},"c2":{src:"assets/c2.webp",w:128,h:67}},
  ballast:{"l1":{src:"assets/l1.webp",w:119,h:120},"l2":{src:"assets/l2.webp",w:128,h:60}},
  sensors:{"n1":{src:"assets/n1.webp",w:114,h:120},"n2":{src:"assets/n2.webp",w:128,h:54}},
};

const ARMOR_SPRITES = { a1:{src:"assets/a1.webp",w:512,h:95}, a2:{src:"assets/a2.webp",w:512,h:107}, a3:{src:"assets/a3.webp",w:512,h:126} };



/* ============================================================
   A3 — REGISTRE CHÂSSIS UNIFIÉ. Un châssis = UN objet : palier,
   géométrie (spec), étages internes, fiche boutique (info),
   sprite. wedge/dart : hérités du moteur, non achetables (pas
   d'info). Les anciens noms (CHASSIS_SPEC, CHASSIS_INFO,
   CHASSIS_SPRITES, CHASSIS_TIER, INTERNAL_FLOORS) sont des VUES
   dérivées — n'éditer que CHASSIS_REG.
   ============================================================ */
/* ============================================================
   S18 — SÉRIES DE CHÂSSIS. Une série est une FAMILLE de coques
   partageant un langage industriel (matière, époque, gamme).
   Aujourd'hui : pure métadonnée (regroupement en boutique).
   Demain : structurante — le marchand tiendra des séries selon
   la progression, et les concours pourront exiger/exclure une
   série. Les châssis de séries DIFFÉRENTES concourent entre eux :
   la série ne segmente pas le jeu, elle l'habille.
   Une série couvre plusieurs classes (5 coques S, 6 coques M
   pour la série d'origine). Ajouter une série = une entrée ici
   plus `series:"<id>"` sur ses châssis. Zéro code.
   ============================================================ */
const CHASSIS_SERIES = {
  antan: { id:"antan", order:1, accent:"#b08d57",     // laiton/rouille : entrée de gamme assumée
           name:{ fr:"Tôles d\u2019Antan", en:"Old Iron" },
           blurb:{ fr:"Acier plié, rivets apparents, deuxi\u00E8me vie. Robuste et pas cher.",
                   en:"Folded steel, exposed rivets, second life. Tough and cheap." } },
};
const DEFAULT_SERIES = "antan";
const CHASSIS_REG = {
  boxy:   { series:"antan", tier:"beetle", floors:1,
            spec:{ front:2, rear:7, hFront:3.0, hRear:3.0 },
            info:{ name:"RUSTY", cost:195 },   // E7 : l'entrée M budget (fin du cadeau)
            sprite:{ src:RUSTY_SPRITE_SRC, body:{x:61,y:46,w:390,h:419} } },
  fleche: { series:"antan", tier:"beetle",
            spec:{ mask:["....##....","....##....","...####...","...####...","..######..","..######..","..######..","..######..","....##...."], front:0, rear:8 },
            info:{ name:"FLÈCHE", cost:220 },
            sprite:{ src:FLECHE_SRC, body:{x:107,y:20,w:297,h:470} } },
  losange:{ series:"antan", tier:"beetle",
            spec:{ mask:["....##....","...####...","..######..",".########.",".########.","..######..","...####...","....##...."], front:0, rear:7 },
            info:{ name:"LOSANGE", cost:240 },
            sprite:{ src:LOSANGE_SRC, body:{x:21,y:13,w:470,h:482} } },
  tortue: { series:"antan", tier:"beetle",
            spec:{ mask:["...####...","..######..",".########.",".########.","..######..","...####..."], front:0, rear:5 },
            info:{ name:"TORTUE", cost:300 },
            sprite:{ src:TORTUE_SRC, body:{x:25,y:17,w:461,h:478} } },
  marteau:{ series:"antan", tier:"beetle",
            spec:{ mask:[".########.",".########.","...####...","...####...","...####...",".########.",".########."], front:0, rear:6 },
            info:{ name:"MARTEAU", cost:340 },
            sprite:{ src:MARTEAU_SRC, body:{x:29,y:36,w:452,h:446} } },
  disque: { series:"antan", tier:"beetle",
            spec:{ mask:["...####...","..######..",".########.",".########.",".########.",".########.","..######..","...####..."], front:0, rear:7 },
            info:{ name:"DISQUE", cost:420 },
            sprite:{ src:DISQUE_SRC, body:{x:30,y:31,w:449,h:448} } },
  /* ══ E4 — CLASSE S (Beetleweight 3 lb / 1,36 kg imposé par les CONCOURS).
     Coques 3 cellules de large (9 cm), masques dérivés de l'alpha des sprites,
     masses = QC tôle 2,5 mm. Catalogue de pièces PARTAGÉ : la limite de poids
     fait le tri (décision « les concours imposent les règles »). ══ */
  tortue_s: { series:"antan", tier:"beetle",
            spec:{ mask:["###", "###", "###"], front:0, rear:2 },
            info:{ name:"TORTUE S", cost:90 },
            sprite:{ src:"assets/tortue_s.webp", body:{x:0,y:0,w:804,h:851} } },
  hex_s:   { series:"antan", tier:"beetle",
            spec:{ mask:["###", "###", "###"], front:0, rear:2 },
            info:{ name:"HEX S", cost:95 },
            sprite:{ src:"assets/hex_s.webp", body:{x:0,y:0,w:762,h:780} } },
  coin_s:  { series:"antan", tier:"beetle",
            spec:{ mask:["###", "###", ".#.", ".#."], front:0, rear:3 },
            info:{ name:"COIN S", cost:105 },
            sprite:{ src:"assets/coin_s.webp", body:{x:0,y:0,w:698,h:892} } },
  losange_s:{ series:"antan", tier:"beetle",
            spec:{ mask:[".#.", "###", "###", ".#."], front:0, rear:3 },
            info:{ name:"LOSANGE S", cost:110 },
            sprite:{ src:"assets/losange_s.webp", body:{x:0,y:0,w:586,h:900} } },
  totem_s: { series:"antan", tier:"beetle",
            spec:{ mask:["###", "###", "###", ".#."], front:0, rear:3 },
            info:{ name:"TOTEM S", cost:120 },
            sprite:{ src:"assets/totem_s.webp", body:{x:0,y:0,w:605,h:900} } },
  wedge:  { series:"antan", tier:"beetle", floors:2, spec:{ front:2, rear:8, hFront:0.9, hRear:2.0 } },
  dart:   { series:"antan", tier:"beetle", floors:2, spec:{ front:2, rear:8, hFront:0.6, hRear:1.8 } },
};
const _regView = (k)=>Object.fromEntries(Object.entries(CHASSIS_REG).filter(([,v])=>v[k]!==undefined).map(([c,v])=>[c,v[k]]));
const CHASSIS_SPEC    = _regView("spec");
const CHASSIS_INFO    = _regView("info");
const CHASSIS_SPRITES = _regView("sprite");
const INTERNAL_FLOORS = _regView("floors");
const CHASSIS_SERIE   = _regView("series");
const CHASSIS_TIER    = Object.fromEntries(Object.entries(CHASSIS_REG).filter(([,v])=>v.tier!=="beetle").map(([c,v])=>[c,v.tier]));
const BUYABLE_CHASSIS = Object.keys(CHASSIS_INFO).filter(c=>CHASSIS_INFO[c].cost>0).sort((a,b)=>CHASSIS_INFO[a].cost-CHASSIS_INFO[b].cost);

/* ============================================================
   A1 — TAXONOMIE : paliers de poids, en données et extensible.
   Une cellule = CELL_CM partout (invariant). Un palier fournit :
   la grille de son éditeur, sa masse max officielle, ses bandes de
   classes S/M/L (en cellules d'emprise), et ses ancres économiques.
   Ajouter un palier (ant, super-heavy...) = une entrée ici, zéro code.
   Bandes feather/heavy provisoires (surface de grille ×1.92 / ×8.16),
   à caler quand leurs châssis existeront.
   ============================================================ */
const TIERS = [
  { id:"beetle",  name:"Hobbyweight",  massMaxKg:5.44,  grid:{w:10,h:10},   // P-MASSE : classes officielles
    classBands:[["S",32],["M",48],["L",68],["XXL",9999]],
    kgPerCellHint:0.025, botPriceEur:[300,500] },
  { id:"feather", name:"Featherweight", massMaxKg:13.6,  grid:{w:16,h:12},
    classBands:[["S",61],["M",92],["L",131],["XXL",9999]],
    kgPerCellHint:0.068, botPriceEur:[1500,2500] },
  { id:"heavy",   name:"Heavyweight",   massMaxKg:113.4, grid:{w:34,h:24},
    classBands:[["S",261],["M",392],["L",555],["XXL",9999]],
    kgPerCellHint:0.28,  botPriceEur:[8000,15000] }];
const TIER_BY_ID = Object.fromEntries(TIERS.map(t=>[t.id,t]));
function tierOf(ch){ return TIER_BY_ID[CHASSIS_TIER[ch]] || TIER_BY_ID.beetle; }
function gridW(ch){ return tierOf(ch).grid.w; }
function gridH(ch){ return tierOf(ch).grid.h; }
const _gcx = {};
function gridCX(ch){ /* E4 : axe miroir = centre de la COQUE, lu directement
   dans le masque (pas de géométrie dérivée : évite toute récursion).
   Identique à grid.w/2 pour les coques symétriques pleine largeur. */
  if (_gcx[ch] != null) return _gcx[ch];
  const sp = CHASSIS_SPEC[ch];
  if (sp && sp.mask){
    let lo = 1e9, hi = -1;
    for (const row of sp.mask) for (let c = 0; c < row.length; c++)
      if (row[c] === "#"){ if (c < lo) lo = c; if (c > hi) hi = c; }
    return _gcx[ch] = (lo + hi + 1) / 2;
  }
  return _gcx[ch] = tierOf(ch).grid.w / 2;
}
const CELL_GAP = 4;


/* ============================================================
   S3 — HIÉRARCHIE DES COMPÉTITIONS (données pures).
   LIGUE (conteneur) → CONCOURS (compétition à format) → MANCHE.
   Ajouter une ligue ou un concours = une entrée ici, zéro code.
   unlock : null = ouvert ; {placeholder:true} = « bientôt » ;
            {level:n} ; {concoursDone:"id"}.
   lockBuild : le build est gelé à l'engagement.
   ============================================================ */
/* ══ S16-SCALE — échelle canonique : 1 cellule = 3 cm = 6,2 unités monde.
   CLASS_RING : diamètre RÉEL du plateau de jeu par classe (cm). S = desk
   sumo 60 cm (mesuré sur arena_s_nerd, décision 25/07) ; M = 145 cm
   (l'ancien ring 300 u, désormais exprimé en vrai). Le ring logique d'un
   match = CLASS_RING de la classe du concours (sinon du bot joueur).
   ARENA_GEOM : géométrie des SPRITES d'arène — playEdge = fraction du
   cadre où se trouve le bord du plateau (mesuré sur l'alpha/luminance) ;
   square = image opaque plein cadre, dessinée carrée SANS clip circulaire.
   Le rendu aligne le bord du plateau dessiné sur le ring logique. ══ */
/* S19 — clés alignées sur le VOCABULAIRE DES BANDES (classBands produit
   S/M/L/XXL, jamais "XL") : l'ancienne entrée XL était morte et XXL manquait,
   si bien qu'une coque XXL aurait pris le ring M en silence. La porte vérifie
   désormais la couverture complète. */
const CLASS_RING = { S:60, M:145, L:145, XXL:145 };
const CM_PER_UNIT = 3/6.2;                       // 1 unité = 0,4839 cm
const ARENA_GEOM = {
  "assets/arena.webp":        { playEdge:0.97 },
  "assets/arena_clean.webp":  { playEdge:0.98 },
  "assets/arena_grim.webp":   { playEdge:0.98 },
  "assets/arena_kawaii.webp": { playEdge:0.98 },
  "assets/arena_s_nerd.webp": { playEdge:0.706, square:true },   // S16 : bord EXTERNE de la bande blanche (mesure 361,5/512 px)
  "assets/arena_m_shop.webp": { playEdge:0.65, square:true },
};
const TOURNAMENTS = [
  { id:"sumoS", arena:"assets/arena_s_nerd.webp", name:{fr:"Defi du Bureau",en:"Desk Challenge"}, format:"championnat", rounds:4,
    unlock:null, lockBuild:true,
    rules:{ tier:"beetle", chassisClass:"S", banWeapons:true, banTracks:true, mode:"sumo",
            maxSoftware:"s1", metrics:{ weightKg:1.36 }, maxCount:{ motor:1, battery:1 } } },
  { id:"sparS", arena:"assets/arena_clean.webp", name:{fr:"Sparring d'Atelier",en:"Workshop Sparring"}, format:"championnat", rounds:6,
    unlock:{beaten:6}, lockBuild:true,
    rules:{ tier:"beetle", chassisClass:"S", banWeapons:true, banTracks:true, mode:"sumo",
            maxSoftware:"s1", metrics:{ weightKg:1.36 }, maxCount:{ motor:1, battery:1, cooling:1, ballast:1 } } },
  { id:"cupS", arena:"assets/arena_grim.webp", name:{fr:"Coupe des Puces",en:"Flea Cup"}, format:"bracket", size:8,
    unlock:{beaten:12}, lockBuild:true,
    rules:{ tier:"beetle", chassisClass:"S", banWeapons:true, banTracks:true, mode:"sumo",
            maxSoftware:"s1", metrics:{ weightKg:1.36 }, maxCount:{ motor:1, battery:1 } } },
  { id:"sumoM", arena:"assets/arena_clean.webp", name:{fr:"Sumo Classe M",en:"Class M Sumo"}, format:"ladder", levels:5,
    unlock:null, lockBuild:false, noEngage:true,   // progression longue globale : pas d'acte d'engagement
    rules:{ tier:"beetle", chassisClass:"M", banWeapons:true, mode:"sumo",
            metrics:{ weightKg:5.44 }, maxCount:{ motor:3, battery:3 } } },
  { id:"lightM", arena:"assets/arena_m_shop.webp", name:{fr:"Sumo Léger",en:"Lightweight Sumo"}, format:"championnat", rounds:10,
    unlock:{beaten:12}, lockBuild:true,
    rules:{ tier:"beetle", chassisClass:"M", banWeapons:true, banTracks:true, mode:"sumo",
            metrics:{ weightKg:4.80 }, maxCount:{ motor:1, battery:1, cooling:1, ballast:1 } } },
  { id:"cupM", arena:"assets/arena_grim.webp", name:{fr:"Coupe M",en:"Cup M"}, format:"bracket", size:16,
    unlock:{beaten:24}, lockBuild:true,
    rules:{ tier:"beetle", chassisClass:"M", banWeapons:true, mode:"sumo",
            metrics:{ weightKg:5.44 }, maxCount:{ motor:3, battery:3 } } },
  { id:"libre", arena:"assets/arena_kawaii.webp", name:{fr:"Combat libre",en:"Free Fight"}, format:"libre",
    unlock:null, lockBuild:false, noEngage:true,   // exhibition : ni engagement, ni progression
    rules:{ tier:"beetle" } }];
/* E1 — barème de gains en EUROS par niveau d'échelle (source unique).
   Calibré au simulateur (scénario D) : 1er achat < 15 min, contenu M 11-18 h. */
const WIN_EUR = [0, 12, 20, 32, 50, 80];
/* E3b — dégâts : fragilité par slot (l'électronique casse, le lest s'en fiche,
   le software est immatériel) et constantes de conversion impulsion→usure.
   Réparation = usure × prix × RATE, jamais sous FLOOR ; le châssis ne se
   démonte pas : réparation seule, sur une base forfaitaire. */
const FRAGILITY = { sensors:2.2, cpu:1.6, cooling:1.2, motor:1.0, battery:1.0,
  weapon1:1.0, weapon2:1.0, srimech:0.8, propulsion:0.7, armor:0.6, ballast:0.3, software:0 };
const DAMAGE_TUNE = { DIRECT_K:0.081, VIB_K:0.011, GRIND_K:0.35, CHASSIS_J_K:0.0165, CHASSIS_GRIND_K:0.16,
  REPAIR_RATE:0.6, REPAIR_FLOOR:8, CHASSIS_REPAIR_BASE:180 };
const LIGUES = [
  /* E4 — CIRCUIT GARAGE : l'arc S. Bourses ×0.35 (petites classes, petites
     primes) ; la finale de la Coupe des Puces paie la PRIME DE MONTÉE (200 €). */
  { id:"garage", name:{fr:"Circuit Garage",en:"Garage Circuit"}, tier:"beetle", unlock:null, purseMult:0.35,
    concours:["sumoS","sparS","cupS"] },
  { id:"regionale", name:{fr:"Ligue Régionale",en:"Regional League"}, tier:"beetle", unlock:null, purseMult:1,
    concours:["sumoM","lightM","cupM","libre"] },
  { id:"nationale", name:{fr:"Ligue Nationale",en:"National League"}, tier:"beetle", unlock:{placeholder:true}, purseMult:2.5,
    concours:[] },                          // placeholder assumé
  { id:"internationale", name:{fr:"Ligue Internationale",en:"International League"}, tier:"beetle", unlock:{placeholder:true}, purseMult:6,
    concours:[] },                          // placeholder assumé
];


/* ============================================================
   S10 — STICKERS SPRITE (remplacent les emojis).
   Placement LIBRE dans la coque : positions continues {x,y} en cellules,
   la grille ne contraint plus les décalcomanies.
   VSTICKERS : banque des plaques de version logicielle — v0 offerte,
   vN accordée automatiquement et gratuitement quand le logiciel sN est
   possédé. Les plaques sans logiciel correspondant restent en banque
   (axe de développement : le tuning logiciel).
   ============================================================ */
/* S18 — TAILLE DES STICKERS PAR CLASSE. Un sticker mesurait 1,6 cellule de
   haut quelle que soit la coque : 27 % d'une coque M (6 rangées), mais 53 %
   d'une coque S (3 rangées) — d'où des autocollants énormes en S. Le facteur
   est désormais DÉRIVÉ de la classe du bot ; la provision L/XXL est posée. */
const STICKER_SCALE = { S:0.5, M:1, L:1.35, XXL:1.6 };
const STICKERS = [
  {id:"chev_red", src:"assets/stickers/chev_red.webp", w:160, h:48, cost:8},
  {id:"chev_yel", src:"assets/stickers/chev_yel.webp", w:160, h:48, cost:8},
  {id:"stripe_rw", src:"assets/stickers/stripe_rw.webp", w:160, h:40, cost:8},
  {id:"hazard_worn", src:"assets/stickers/hazard_worn.webp", w:160, h:33, cost:8},
  {id:"chev_tall", src:"assets/stickers/chev_tall.webp", w:160, h:46, cost:8},
  {id:"p13", src:"assets/stickers/p13.webp", w:160, h:110, cost:10},
  {id:"p23", src:"assets/stickers/p23.webp", w:160, h:98, cost:10},
  {id:"trn88", src:"assets/stickers/trn88.webp", w:160, h:65, cost:10},
  {id:"push", src:"assets/stickers/push.webp", w:160, h:78, cost:10},
  {id:"mkii", src:"assets/stickers/mkii.webp", w:132, h:73, cost:10},
  {id:"co2", src:"assets/stickers/co2.webp", w:130, h:73, cost:10},
  {id:"ir", src:"assets/stickers/ir.webp", w:136, h:72, cost:10},
  {id:"lidar", src:"assets/stickers/lidar.webp", w:137, h:72, cost:10},
  {id:"hotsurf", src:"assets/stickers/hotsurf.webp", w:121, h:108, cost:10},
  {id:"danger", src:"assets/stickers/danger.webp", w:119, h:109, cost:10},
  {id:"nostep", src:"assets/stickers/nostep.webp", w:117, h:108, cost:10},
  {id:"w_bang", src:"assets/stickers/w_bang.webp", w:119, h:107, cost:15},
  {id:"w_fire", src:"assets/stickers/w_fire.webp", w:117, h:108, cost:15},
  {id:"w_gears", src:"assets/stickers/w_gears.webp", w:114, h:141, cost:15},
  {id:"w_crush", src:"assets/stickers/w_crush.webp", w:143, h:141, cost:15},
  {id:"w_skull", src:"assets/stickers/w_skull.webp", w:109, h:137, cost:15},
  {id:"skull", src:"assets/stickers/skull.webp", w:81, h:142, cost:15},
  {id:"target", src:"assets/stickers/target.webp", w:119, h:144, cost:15},
  {id:"saw", src:"assets/stickers/saw.webp", w:108, h:145, cost:15},
  {id:"sumo", src:"assets/stickers/sumo.webp", w:152, h:100, cost:25},
  {id:"arena", src:"assets/stickers/arena.webp", w:149, h:129, cost:25},
  {id:"season3", src:"assets/stickers/season3.webp", w:124, h:135, cost:25},
  {id:"top8", src:"assets/stickers/top8.webp", w:133, h:133, cost:25},
  {id:"first", src:"assets/stickers/first.webp", w:125, h:133, cost:25},
  {id:"star", src:"assets/stickers/star.webp", w:142, h:139, cost:25},
  {id:"crown", src:"assets/stickers/crown.webp", w:138, h:107, cost:25},
  {id:"f_angry", src:"assets/stickers/f_angry.webp", w:99, h:98, cost:12},
  {id:"f_smile", src:"assets/stickers/f_smile.webp", w:96, h:97, cost:12},
  {id:"f_blank", src:"assets/stickers/f_blank.webp", w:98, h:97, cost:12},
  {id:"f_ko", src:"assets/stickers/f_ko.webp", w:98, h:97, cost:12},
  {id:"tally_r", src:"assets/stickers/tally_r.webp", w:120, h:81, cost:12},
  {id:"tally_w", src:"assets/stickers/tally_w.webp", w:112, h:82, cost:12},
  {id:"tally_k", src:"assets/stickers/tally_k.webp", w:153, h:85, cost:12},
  {id:"scr_gray", src:"assets/stickers/scr_gray.webp", w:160, h:74, cost:12},
  {id:"scr_red", src:"assets/stickers/scr_red.webp", w:160, h:72, cost:12},
  {id:"scr_blue", src:"assets/stickers/scr_blue.webp", w:160, h:69, cost:12},
  {id:"scr_orange", src:"assets/stickers/scr_orange.webp", w:160, h:69, cost:12},
  {id:"scr_hex", src:"assets/stickers/scr_hex.webp", w:160, h:77, cost:12},
  {id:"scr_wr", src:"assets/stickers/scr_wr.webp", w:160, h:71, cost:12}];
const VSTICKERS = [
  {id:"v0", src:"assets/stickers/v0.webp", w:128, h:123, sw:null},
  {id:"v1", src:"assets/stickers/v1.webp", w:128, h:123, sw:"s1"},
  {id:"v2", src:"assets/stickers/v2.webp", w:128, h:124, sw:"s2"},
  {id:"v3", src:"assets/stickers/v3.webp", w:128, h:119, sw:"s3"},
  {id:"v4", src:"assets/stickers/v4.webp", w:128, h:118, sw:"s4"},
  {id:"v5", src:"assets/stickers/v5.webp", w:128, h:121, sw:"s5"},
  {id:"v6", src:"assets/stickers/v6.webp", w:128, h:122, sw:"s6"},
  {id:"v7", src:"assets/stickers/v7.webp", w:128, h:120, sw:"s7"},
  {id:"v8", src:"assets/stickers/v8.webp", w:128, h:122, sw:"s8"},
  {id:"v9", src:"assets/stickers/v9.webp", w:128, h:122, sw:"s9"}];
