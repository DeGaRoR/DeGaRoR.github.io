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
    pn_b0:"Pack gonflé", pn_b1:"LiPo 4S", pn_b2:"LiPo 6S", pn_b3:"Brique graphène",
    pn_pr0:"Deux roues + patins", pn_pr1:"4×4 crampons", pn_pr2:"Triporteur sport", pn_pr3:"Chenilles acier",
    garageTitle:"Garage", botBought:"{name} acheté !", onOtherBot:"{n} sur un autre bot",
    scrClass:"Classe {c} requise (ton bot est {got})", scrTracks:"Chenilles interdites",
    scrWeapons:"Armes interdites", scrBanned:"{p} interdit", scrSoftware:"Software max v{v}",
    scrMetric:"{m} {v}{u} > max {c}{u}", scrPass:"Éligible", scrFail:"Non éligible", shopUsed:"Occasions du jour", usedWear:"usure {w} %", usedSold:"Vendu", scrTier:"Palier {tr} requis", scrCount:"{p} ×{n} > max ×{c}", dbTitle:"Débriefing", dbBattery:"Batterie restante", dbDist:"Distance parcourue", dbContact:"Temps au contact", dbFlipped:"Temps retourné", endShrinkOut:"mort subite (piste rétrécie)", endRingOut:"sortie de piste", endKoFlip:"KO retourné", tournaments:"Tournois", unlimited:"Sans limite", soon:"Bientôt jouable", leagueRound:"Manche {r}/{n} · {rank}ᵉ", leagueTable:"Classement", you:"VOUS", bracketNext:"Qualifié · {r}", bracketChamp:"CHAMPION", bracketOut:"Éliminé", bracketPrize:"+{total} 🔩", bracketTitle:"Coupe M", bracketDone:"terminée", leagueDone:"Saison terminée", leaguePrize:"{rank}ᵉ au classement · +{total} 🔩", pn_a0:"(tôle nue)", pn_a1:"Pare-choc", pn_a2:"Lame acier", pn_a3:"Fourche",
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
    tourneyPrize:"Prix : {p} 🔩 + badge + niveau {n}",
    tourneyChampPrize:"Prix : {p} 🔩 + badge + titre de CHAMPION",
    tourneyNext:"Match {i}/3 →", tourneyWon:"TOURNOI GAGNÉ !",
    tourneyLost:"Tournoi échoué — on repart au match 1. Le bracket ne change pas : tu le connais mieux maintenant.",
    tourneyReroll:"Tournoi échoué — nouveaux inscrits ! Un bracket tout frais t'attend.",
    oppRetired:"Il s'est retiré du circuit. Un nouvel adversaire arrive.",
    boltsEarned:"+{b} 🔩",
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
    pn_b0:"Puffy pack", pn_b1:"LiPo 4S", pn_b2:"LiPo 6S", pn_b3:"Graphene brick",
    pn_pr0:"Two wheels + skids", pn_pr1:"4×4 lugs", pn_pr2:"Sport trike", pn_pr3:"Steel treads",
    garageTitle:"Garage", botBought:"{name} purchased!", onOtherBot:"{n} on another bot",
    scrClass:"Class {c} required (yours is {got})", scrTracks:"Tracks not allowed",
    scrWeapons:"Weapons not allowed", scrBanned:"{p} banned", scrSoftware:"Software max v{v}",
    scrMetric:"{m} {v}{u} > max {c}{u}", scrPass:"Eligible", scrFail:"Not eligible", shopUsed:"Today's used deals", usedWear:"{w}% wear", usedSold:"Sold", scrTier:"{tr} tier required", scrCount:"{p} ×{n} > max ×{c}", dbTitle:"Debrief", dbBattery:"Battery left", dbDist:"Distance covered", dbContact:"Contact time", dbFlipped:"Time flipped", endShrinkOut:"sudden death (shrinking floor)", endRingOut:"ring-out", endKoFlip:"KO (flipped)", tournaments:"Tournaments", unlimited:"No limit", soon:"Coming soon", leagueRound:"Round {r}/{n} · {rank}th", leagueTable:"Standings", you:"YOU", bracketNext:"Through · {r}", bracketChamp:"CHAMPION", bracketOut:"Eliminated", bracketPrize:"+{total} 🔩", bracketTitle:"Cup M", bracketDone:"done", leagueDone:"Season over", leaguePrize:"{rank} in table · +{total} 🔩", pn_a0:"(bare plate)", pn_a1:"Bumper", pn_a2:"Steel blade", pn_a3:"Fork",
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
    tourneyPrize:"Prize: {p} 🔩 + badge + level {n}",
    tourneyChampPrize:"Prize: {p} 🔩 + badge + CHAMPION title",
    tourneyNext:"Match {i}/3 →", tourneyWon:"TOURNAMENT WON!",
    tourneyLost:"Tournament failed — back to match 1. Same bracket: you know it better now.",
    tourneyReroll:"Tournament failed — new entrants! A fresh bracket awaits.",
    oppRetired:"He retired from the circuit. A new opponent steps in.",
    boltsEarned:"+{b} 🔩",
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
const CHASSIS_REG = {
  boxy:   { tier:"beetle", floors:1,
            spec:{ front:2, rear:7, hFront:3.0, hRear:3.0 },
            info:{ name:"RUSTY", cost:0 },
            sprite:{ src:RUSTY_SPRITE_SRC, body:{x:61,y:46,w:390,h:419} } },
  fleche: { tier:"beetle",
            spec:{ mask:["....##....","....##....","...####...","...####...","..######..","..######..","..######..","..######..","....##...."], front:0, rear:8 },
            info:{ name:"FLÈCHE", cost:220 },
            sprite:{ src:FLECHE_SRC, body:{x:107,y:20,w:297,h:470} } },
  losange:{ tier:"beetle",
            spec:{ mask:["....##....","...####...","..######..",".########.",".########.","..######..","...####...","....##...."], front:0, rear:7 },
            info:{ name:"LOSANGE", cost:240 },
            sprite:{ src:LOSANGE_SRC, body:{x:21,y:13,w:470,h:482} } },
  tortue: { tier:"beetle",
            spec:{ mask:["...####...","..######..",".########.",".########.","..######..","...####..."], front:0, rear:5 },
            info:{ name:"TORTUE", cost:300 },
            sprite:{ src:TORTUE_SRC, body:{x:25,y:17,w:461,h:478} } },
  marteau:{ tier:"beetle",
            spec:{ mask:[".########.",".########.","...####...","...####...","...####...",".########.",".########."], front:0, rear:6 },
            info:{ name:"MARTEAU", cost:340 },
            sprite:{ src:MARTEAU_SRC, body:{x:29,y:36,w:452,h:446} } },
  disque: { tier:"beetle",
            spec:{ mask:["...####...","..######..",".########.",".########.",".########.",".########.","..######..","...####..."], front:0, rear:7 },
            info:{ name:"DISQUE", cost:420 },
            sprite:{ src:DISQUE_SRC, body:{x:30,y:31,w:449,h:448} } },
  wedge:  { tier:"beetle", floors:2, spec:{ front:2, rear:8, hFront:0.9, hRear:2.0 } },
  dart:   { tier:"beetle", floors:2, spec:{ front:2, rear:8, hFront:0.6, hRear:1.8 } },
};
const _regView = (k)=>Object.fromEntries(Object.entries(CHASSIS_REG).filter(([,v])=>v[k]!==undefined).map(([c,v])=>[c,v[k]]));
const CHASSIS_SPEC    = _regView("spec");
const CHASSIS_INFO    = _regView("info");
const CHASSIS_SPRITES = _regView("sprite");
const INTERNAL_FLOORS = _regView("floors");
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
  { id:"beetle",  name:"Beetleweight",  massMaxKg:1.36,  grid:{w:10,h:10},
    classBands:[["S",32],["M",48],["L",68],["XXL",9999]],
    kgPerCellHint:0.025, botPriceEur:[300,500] },
  { id:"feather", name:"Featherweight", massMaxKg:13.6,  grid:{w:16,h:12},
    classBands:[["S",61],["M",92],["L",131],["XXL",9999]],
    kgPerCellHint:0.068, botPriceEur:[1500,2500] },
  { id:"heavy",   name:"Heavyweight",   massMaxKg:113.4, grid:{w:34,h:24},
    classBands:[["S",261],["M",392],["L",555],["XXL",9999]],
    kgPerCellHint:0.28,  botPriceEur:[8000,15000] },
];
const TIER_BY_ID = Object.fromEntries(TIERS.map(t=>[t.id,t]));
function tierOf(ch){ return TIER_BY_ID[CHASSIS_TIER[ch]] || TIER_BY_ID.beetle; }
function gridW(ch){ return tierOf(ch).grid.w; }
function gridH(ch){ return tierOf(ch).grid.h; }
function gridCX(ch){ return tierOf(ch).grid.w/2; }
const CELL_GAP = 4;
