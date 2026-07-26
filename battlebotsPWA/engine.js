/* engine.js — moteur pur, déterministe, sans DOM. Testé seul par le harness.
   Ne doit référencer NI data.js NI app.js. Marqueurs ENGINE-START/END conservés
   pour extract.js (artefact CommonJS de test). */
// ENGINE-START
const ENGINE = (() => {
  function makeRng(seed){
    let a = seed >>> 0;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const V = {
    add:(a,b)=>({x:a.x+b.x, y:a.y+b.y}),
    sub:(a,b)=>({x:a.x-b.x, y:a.y-b.y}),
    scl:(a,s)=>({x:a.x*s, y:a.y*s}),
    dot:(a,b)=>a.x*b.x+a.y*b.y,
    len:(a)=>Math.hypot(a.x,a.y),
    norm:(a)=>{const l=Math.hypot(a.x,a.y)||1; return {x:a.x/l, y:a.y/l};},
    fromAngle:(t)=>({x:Math.cos(t), y:Math.sin(t)}),
    perp:(a)=>({x:-a.y, y:a.x}),
  };
  // RENDER CONTRACT (3D-ready): the engine only produces geometric state
  // (pos, angle, radius, flippedT, dominatedT, throttles, part ids) and a
  // timestamped event stream. It never touches pixels, colors, or meshes.
  // A renderer (canvas 2D today, three.js tomorrow) maps part ids -> visuals
  // and reads state each frame. Adding z later = extending V and pos, nothing else.
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const angNorm=(t)=>{ while(t>Math.PI)t-=2*Math.PI; while(t<-Math.PI)t+=2*Math.PI; return t; };

  /* S19 — champs VIVANTS uniquement. `mass`, `tractionBase`, `speedBase` et
     `pushBase` vivaient ici sans être lus depuis le passage aux masses
     réelles (P-MASSE) : la masse de simulation vient de physStats →
     PHYS.chassis[].kg, et pousssée/vitesse de la banque physique. Pire, la
     `mass` fantôme divergeait du réel (boxy 1,5 contre 3,25 kg) et piégeait
     quiconque ajoutait une coque. Champs restants, tous lus : radius (rayon
     de collision, saveur voulue par coque — PAS dérivable des cellules sans
     déplacer l'équilibre), leverage, battery, selfRight. */
  /* ══ S24-MATIÈRE — la coque a enfin une propriété MÉCANIQUE autre que sa masse.
     Jusqu'ici l'intégrité valait 300 × masse totale : une coque plastique et une
     coque acier de même poids étaient rigoureusement aussi solides, et l'usure
     comme le prix de réparation étaient des constantes globales. Une série ne
     pouvait donc être que cosmétique.

     `hull` = ténacité de la matière, facteur sur l'intégrité structurelle ET sur
     l'usure de coque (les deux faces de la même propriété : ce qui encaisse mal
     se répare souvent). 1,00 = tôle d'acier, la référence.

     `densite` ne sert PAS au moteur : c'est le facteur d'AUTORAT de la masse
     (hull_masses.json mesure une aire d'alpha, la matière donne le kg/cm²). La
     masse reste STOCKÉE et mesurée, comme le rayon — on ne la dérive pas au
     runtime, on la pose à l'intégration de l'asset. ══ */
  const MATIERES = {
    acier:   { hull:1.00, densite:1.00 },  // Tôles d'Antan — la référence
    recup:   { hull:0.82, densite:0.95 },  // La Casse : tôle fatiguée, soudures d'occasion
    plastik: { hull:0.62, densite:0.45 },  // Plastik : polymère moulé, léger et cassant
    polypro: { hull:0.98, densite:0.55 },  // Polymère Pro : composite haute densité
    circuit: { hull:0.78, densite:0.50 },  // Ligne Circuit : électronique intégrée, fragile
  };
  const MAT_DEF = "acier";
  const matOf = (ch) => MATIERES[(CHASSIS[ch] && CHASSIS[ch].mat) || MAT_DEF] || MATIERES[MAT_DEF];
  const hullOf = (ch) => matOf(ch).hull;

  const CHASSIS = {
    wedge: { radius:17, leverage:2.4, battery:100, selfRight:1.6 },
    boxy:  { radius:20, leverage:0.9, battery:130, selfRight:3.5 },
    dart:  { radius:14, leverage:1.3,  battery:80,  selfRight:2.2 },
    fleche:{ radius:21, leverage:2.2, battery:136, selfRight:2.4 },
    marteau:{ radius:24, leverage:1.0, battery:155, selfRight:2.6 },
    tortue:{ radius:20, leverage:1.4, battery:130, selfRight:2.8 },
    losange:{ radius:22, leverage:2.0, battery:142, selfRight:2.2 },
    disque:{ radius:27, leverage:1.2, battery:180, selfRight:3.0 },
    /* S16-SCALE — coques S : rayons VÉRITÉ CELLULES (retrade du ratio 0,31,
       décision 25/07). Convention M conservée : rayon ≈ demi-dimension de la
       coque en unités (3 cellules = 9 cm = 18,6 u de large → ~9,3-10,5 u
       selon la profondeur 3-4 cellules). Les colliders par composant étaient
       DÉJÀ à cette échelle : l'IA rejoint enfin le contact réel.
       Décharges batterie inchangées (masse réelle faible + K_FORCE commun). */
    tortue_s: { radius:9.5,  leverage:1.2, battery:58, selfRight:3.2 },
    hex_s:    { radius:9.5,  leverage:1.3, battery:60, selfRight:3.0 },
    coin_s:   { radius:10,   leverage:2.1, battery:58, selfRight:2.2 },
    losange_s:{ radius:10.5, leverage:1.8, battery:62, selfRight:2.4 },
    totem_s:  { radius:10.5, leverage:1.5, battery:64, selfRight:2.8 },
  };
  const OPTS = {
    strategy:   ["adaptive","pressure","counter","ambush"],
    aggression: ["cautious","balanced","fierce"],
    edgeGuard:  ["daredevil","normal","fearful"],
    approach:   ["frontal","flank","opportunist"],
    power:      ["speed","mixed","torque"],
    chargeDist: ["short","medium","long"],
    handling:   ["stable","nervous","drift"],
  };
  const DEFAULT_BUILD = { chassis:"boxy", strategy:"adaptive", aggression:"balanced", edgeGuard:"normal",
    approach:"frontal", power:"mixed", chargeDist:"medium", handling:"stable" };

  const POWER = { speed:{spd:1.25,push:0.75}, mixed:{spd:1.0,push:1.0}, torque:{spd:0.78,push:1.35} };
  const GUARD = { daredevil:20, normal:38, fearful:58 };
  const CHARGE = { short:60, medium:110, long:200 };
  const HANDLING = {
    stable:  {turnMax:2.6, latDamp:0.78, jitter:0.02},
    nervous: {turnMax:4.6, latDamp:0.80, jitter:0.10},
    drift:   {turnMax:3.6, latDamp:0.92, jitter:0.05},
  };

  /* S20-GAMME — chaque pièce déclare son RANG DE GAMME. La couleur de tuile se
     lisait sur la POSITION dans le tableau : une pièce ajoutée en fin de liste
     s'affichait « haut de gamme » quelle que soit sa nature, et insérer une
     gamme micro aurait reteinté tout le catalogue. gamme est une DONNÉE
     d'affichage et de tri — jamais une règle de jeu. Valeurs = positions
     actuelles : ce correctif ne change aucune couleur, il les dépositionne. */
  // parts catalog v4 — Denis's invariant taxonomy. FROZEN ids (extend, never renumber).
  // Every part carries its own attributes incl. MASS; bot stats aggregate from parts.
  // Slots with no purchasable entries yet (weapons) are reserved by design.
  const PARTS = {
    propulsion: [ // drive architecture: wheels/treads/layout -> traction & style
      {id:"pr0", gamme:0, cost:0,   traction:1.00, mass:0,    style:"worn"},
      {id:"pr1", gamme:1, cost:90,  traction:1.12, mass:0.06, style:"lug"},
      {id:"pr2", gamme:2, cost:140, traction:1.18, mass:0.04, style:"slick"},
      {id:"pr3", gamme:3, cost:200, traction:1.30, mass:0.16, style:"tread"},
      /* ══ S24-ROUES — train roulant de la classe S (spec Denis, 26/07).
         SIX formats, DEUX roues par design (une empreinte, miroir L/R — c'est
         déjà le modèle du slot). pr1 est un 1×4, pr2 un 2×3, pr3 un 2×5 : en
         9 cellules aucun n'a sa place. Ceux-ci vont du 1×1 au 2×1.

         `guard` = PROTECTION : la roue encaisse à la place du châssis. Les
         chocs qui la frappent transmettent (1 − guard) de leur énergie à
         l'intégrité. C'est le crochet que le chantier armes reprendra pour
         le blindage latéral — ici il vit déjà, en petit.

         Attention à l'intuition : l'adhérence vaut μ·m·g, donc une roue
         LÉGÈRE accroche moins malgré un bon coefficient. La masse est un
         avantage en sumo — d'où des roues « high grip » franchement lourdes,
         et un vrai arbitrage place / masse / plafond de pesée. */
      {id:"pr4", gamme:1, cost:60,  traction:1.04, mass:0.03, style:"lug",   intendedClass:"S", guard:0},     // 1x1 base
      {id:"pr5", gamme:2, cost:170, traction:1.14, mass:0.06, style:"lug",   intendedClass:"S", guard:0.30},  // 1x1 grip + protection
      {id:"pr6", gamme:1, cost:110, traction:1.06, mass:0.05, style:"slick", intendedClass:"S", guard:0},     // 1x2 large, faible grip
      {id:"pr7", gamme:2, cost:180, traction:1.16, mass:0.08, style:"slick", intendedClass:"S", guard:0},     // 1x2 large, grip moyen
      {id:"pr8", gamme:3, cost:250, traction:1.26, mass:0.11, style:"slick", intendedClass:"S", guard:0},     // 1x2 large, grip élevé
      {id:"pr9", gamme:3, cost:330, traction:1.26, mass:0.14, style:"lug",   intendedClass:"S", guard:0.45},  // 2x1 large blindée, grip élevé
    ],
    motor: [
      {id:"m0", gamme:0, cost:0,   push:1.00, speed:1.00, mass:0},
      {id:"m1", gamme:1, cost:60,  push:1.15, speed:1.07, mass:0.04},
      {id:"m2", gamme:2, cost:150, push:1.30, speed:1.14, mass:0.08},
      {id:"m3", gamme:3, cost:230, push:1.45, speed:1.05, mass:0.14},  // KV90: torque monster
      {id:"m4", gamme:4, cost:230, push:1.10, speed:1.40, mass:0.06},  // KV600: sprint
      /* S24-MICRO — gamme micro : les moteurs qui RENTRENT en classe S.
         m1 et m2 sont des 2×2, m3/m4 des 3×2 et 3×3 : sur une coque S de
         9 cellules avec ses roues, aucun n'entre (mesuré : m1 ne loge que dans
         totem_s). La classe S n'avait donc AUCUNE montée en moteur. Ceux-ci
         sont 1×1 et 1×2, plus chers et un peu moins performants que leurs
         équivalents M — on paie la miniaturisation, comme en vrai. */
      {id:"m5", gamme:1, cost:130, push:1.13, speed:1.09, mass:0.03, intendedClass:"S"},  // 1x1
      {id:"m6", gamme:2, cost:260, push:1.27, speed:1.11, mass:0.05, intendedClass:"S"},  // 1x2
    ],
    cpu: [ // decision latency (re-plan cadence) + servo gain (alignment speed)
      {id:"c0", gamme:0, cost:0,   interval:18, gain:0.85, mass:0},
      {id:"c1", gamme:1, cost:120, interval:8,  gain:1.05, mass:0.01},
      {id:"c2", gamme:2, cost:240, interval:3,  gain:1.30, mass:0.02},
    ],
    battery: [
      {id:"b0", gamme:0, cost:0,   energy:1.00, mass:0},
      {id:"b1", gamme:1, cost:50,  energy:1.20, mass:0.03},
      {id:"b2", gamme:2, cost:120, energy:1.40, mass:0.06},
      {id:"b3", gamme:3, cost:190, energy:1.65, mass:0.12},
    ],
    armor: [ // blindage & prise
      {id:"a0", gamme:0, cost:0,   leverage:0,    mass:0},
      {id:"a1", gamme:1, cost:90,  leverage:0.12, mass:0.05},
      {id:"a2", gamme:2, cost:180, leverage:0.30, mass:0.08},
      {id:"a3", gamme:3, cost:260, leverage:0.45, mass:0.15},
    ],
    weapon1: [ {id:"w0", gamme:0, cost:0, mass:0} ],   // reserved: sumo rules, no weapons yet
    weapon2: [ {id:"x0", gamme:0, cost:0, mass:0} ],   // reserved
    software: [ // behavior packs (interacts with sensors)
      {id:"s0", gamme:0, cost:0,   mass:0},
      {id:"s1", gamme:1, cost:150, mass:0, edgePush:true}, // v2: steer dominated foes toward the edge
      {id:"s2", gamme:2, cost:240, mass:0, edgePush:true, escape:true}, // v3: break contact when overpowered
      /* S29 — v3 « Arbitrage ». Le premier vrai saut : ce n'est plus une
         cascade qui prend la PREMIÈRE règle applicable, c'est un arbitre qui
         évalue TOUTES les enchères et garde la meilleure. Deux modules de
         plus (PATIENCE, FEINT) et des enchères graduées au lieu de booléens.
         id gelé s3 ; le nom d'affichage, lui, dit « v3 » (pn_s3). */
      {id:"s3", gamme:3, cost:320, mass:0, edgePush:true, escape:true, arbiter:"utility"},
    ],
    ballast: [ // lest: mass + friction (weight -> normal force -> grip)
      {id:"l0", gamme:0, cost:0,  mass:0,    grip:0},
      {id:"l1", gamme:1, cost:40, mass:0.07, grip:0.02},
      {id:"l2", gamme:2, cost:90, mass:0.16, grip:0.045},
    ],
    sensors: [ // perception quality -> steering noise
      {id:"n0", gamme:0, cost:0,   noise:1.00, mass:0},
      {id:"n1", gamme:1, cost:110, noise:0.45, mass:0.02},
      {id:"n2", gamme:2, cost:230, noise:0.15, mass:0.03},
    ],
    srimech: [ // self-righting mechanism: multiplies chassis selfRight time
      {id:"r0", gamme:0, cost:0,   srMul:1.00, mass:0},
      {id:"r1", gamme:1, cost:130, srMul:0.60, mass:0.06},
      {id:"r2", gamme:2, cost:240, srMul:0.35, mass:0.09},
      /* S24-MICRO — r1 est un 2×2 et r2 un 3×2 : se relever était un luxe
         inaccessible en classe S, alors que c'est là que les retournements
         décident le plus vite. Formats 1×1 et 1×2. */
      {id:"r3", gamme:1, cost:150, srMul:0.78, mass:0.04, intendedClass:"S"},  // 1x1 bras à ressort
      {id:"r4", gamme:2, cost:270, srMul:0.58, mass:0.07, intendedClass:"S"},  // 1x2 vérin double
    ],
    cooling: [ // consumption efficiency (battery = capacity, cooling = drain)
      {id:"k0", gamme:0, cost:0,   drain:1.00, mass:0},
      {id:"k1", gamme:1, cost:70,  drain:0.95, mass:0.03},
      {id:"k2", gamme:2, cost:160, drain:0.89, mass:0.08},
    ],
  };
  const partOf = (type, id) => PARTS[type].find(p=>p.id===id) || PARTS[type][0];

  // ============================================================
  // PHYSICAL REFERENCE BANK — robot-sumo class (dohyo 154 cm, ≤20×20 cm, ≤3 kg).
  // Real component masses (kg) and electromechanical specs. This is the source
  // of truth for the DISPLAYED figures (kg / Nm / kW / Wh), all bottom-up.
  // STAGE 1: display only — the sim dynamics (force/speed/drain) still use the
  // tuned fields above and get re-derived from these specs in the physics session.
  const G_ACCEL = 9.81, DRIVE_EFF = 0.85;
  // friction model: the dohyo has its own surface factor, and static grip peaks
  // above kinetic. DOHYO_MU=1 is the reference surface (a slick arena would be <1).
  const DOHYO_MU = 1.0, KINETIC_RATIO = 0.8; // μ_kinetic / μ_static
  const VFREE_K = 1.15; // free-speed headroom above the tuned top speed (torque-speed curve)
  const PHYS = {
    /* P-MASSE — classes officielles : M = Hobbyweight 12 lb / 5,44 kg.
       Coques = QC tôle (aire alpha du sprite × 2,5 mm acier, plaques+parois+25 %
       structure — tools/hull_masses.json fait foi dans la porte, ±30 %). */
    chassis: {
      dart:  { kg:2.00, r:0.090 }, wedge: { kg:2.48, r:0.100 }, boxy: { kg:3.25, r:0.110 },
      fleche:{ kg:4.19, r:0.112 },
      marteau:{ kg:3.00, r:0.116 },
      tortue:{ kg:2.93, r:0.11 },
      losange:{ kg:2.16, r:0.113 },
      disque:{ kg:3.39, r:0.121 },
      tortue_s:{ kg:0.58, r:0.045 }, hex_s:{ kg:0.63, r:0.045 },
      coin_s:{ kg:0.63, r:0.045 }, losange_s:{ kg:0.72, r:0.045 }, totem_s:{ kg:0.74, r:0.045 },
    },
    propulsion: { // mu = grip coefficient, rWheel in metres
      pr0:{ kg:0.12, mu:0.70, rWheel:0.025 }, pr1:{ kg:0.30, mu:0.95, rWheel:0.030 },
      pr2:{ kg:0.18, mu:1.05, rWheel:0.028 }, pr3:{ kg:0.55, mu:1.15, rWheel:0.022 },
      // S24-ROUES — banque physique du train roulant S. rWheel : les « larges »
      // ont un plus grand rayon (vitesse), les galets un petit (couple).
      /* rWheel = rayon : il fixe la VITESSE de pointe. La poussée, elle, est
         plafonnée par l'adhérence (min(force moteur, μ·m·g)) — un petit rayon
         ne gagne donc rien en poussée et perd en vitesse. Les rayons restent
         proches ; c'est μ qui porte l'échelle de grip, comme spécifié. */
      pr4:{ kg:0.03, mu:0.80, rWheel:0.026 },   // 1x1 base
      pr5:{ kg:0.06, mu:0.95, rWheel:0.026 },   // 1x1 grip + protection
      pr6:{ kg:0.05, mu:0.85, rWheel:0.032 },   // 1x2 large, faible grip
      pr7:{ kg:0.08, mu:0.98, rWheel:0.032 },   // 1x2 large, grip moyen
      pr8:{ kg:0.11, mu:1.12, rWheel:0.032 },   // 1x2 large, grip élevé
      pr9:{ kg:0.14, mu:1.12, rWheel:0.028 },   // 2x1 large blindée, grip élevé
    },
    motor: { // tau = stall torque per motor (Nm), rpm = free output rpm, P = pair nominal (W)
      m0:{ kg:0.22, tau:0.20, rpm:600,  P:40  }, m1:{ kg:0.28, tau:0.28, rpm:650,  P:60  },
      m2:{ kg:0.34, tau:0.42, rpm:750,  P:120 }, m3:{ kg:0.46, tau:0.75, rpm:500,  P:150 },
      m4:{ kg:0.30, tau:0.30, rpm:1400, P:150 },
      // S24-MICRO : couple honnête sous un volume minuscule, au prix du poids
      // de cuivre — donc de la puissance. Entre m0 et m2, jamais au-dessus.
      m5:{ kg:0.16, tau:0.26, rpm:680, P:55 },   // 1x1
      m6:{ kg:0.21, tau:0.40, rpm:640, P:95 },   // 1x2
    },
    battery: { // real LiPo packs: S cells, mAh -> V, Wh
      b0:{ kg:0.11, S:3, mAh:1300 }, b1:{ kg:0.17, S:4, mAh:1500 },
      b2:{ kg:0.24, S:4, mAh:2200 }, b3:{ kg:0.33, S:6, mAh:2200 },
    },
    armor:   { a0:{kg:0.00}, a1:{kg:0.20}, a2:{kg:0.35}, a3:{kg:0.55} },
    cpu:     { c0:{kg:0.02}, c1:{kg:0.03}, c2:{kg:0.04} },
    sensors: { n0:{kg:0.01}, n1:{kg:0.03}, n2:{kg:0.05} },
    software:{ s0:{kg:0.00}, s1:{kg:0.00}, s2:{kg:0.00}, s3:{kg:0.00} },
    ballast: { l0:{kg:0.00,cog:0}, l1:{kg:0.30,cog:0.30}, l2:{kg:0.60,cog:0.60} }, // slugs sit low → lower CoG, resist flips
    srimech: { r0:{kg:0.00}, r1:{kg:0.15}, r2:{kg:0.25}, r3:{kg:0.04}, r4:{kg:0.07} },
    cooling: { k0:{kg:0.00}, k1:{kg:0.05}, k2:{kg:0.12} },
    weapon1: { w0:{kg:0} }, weapon2:{ x0:{kg:0} },
  };
  const PHYS_SLOTS = ["propulsion","motor","battery","armor","cpu","sensors",
    "software","ballast","srimech","cooling","weapon1","weapon2"];
  const physOf = (slot, id) => (PHYS[slot] && PHYS[slot][id]) || {kg:0};
  const STOCK_ID = {}; for (const s of Object.keys(PARTS)) STOCK_ID[s] = PARTS[s][0].id;
  const partMassKg = (slot, id) => physOf(slot, id).kg || 0;

  // Bottom-up physical figures. Display reads the motor nameplate (torqueNm/
  // powerKW), the sim reads the geared drive (pushN/vmax). The Power lever is a
  // real gear-ratio choice: Couple trades rpm for torque, Vitesse the reverse.
  const STACKABLE = { motor:1, battery:1, cooling:1, ballast:1 };  // L3.5: these slots stack
  const BEAM_KG = 0.018;              // S16-WHEELS : masse d'un segment de longeron (3×3 cm, tôle 2,5 mm)
  function physStats(build){
    const pr = build.parts || {};
    const chassis = build.chassis || "boxy";
    const gear = POWER[build.power] || POWER.mixed;
    const rid = (slot)=> pr[slot] || STOCK_ID[slot];
    const nOf = (slot)=> (build.counts && STACKABLE[slot]) ? Math.max(1, build.counts[slot]|0) : 1;
    const nMotor = nOf("motor"), nBatt = nOf("battery");
    let massKg = PHYS.chassis[chassis].kg;
    /* S16-WHEELS — longerons : masse RÉELLE (tôle 2,5 mm, 3×3 cm ≈ 18 g par
       cellule). beamCells (2 côtés) est DÉRIVÉ du layout côté app et passé
       dans le build — le moteur reste sans DOM. Écart 0 = 0 cellule. */
    if (build.beamCells) massKg += build.beamCells * BEAM_KG;
    for (const slot of PHYS_SLOTS) massKg += partMassKg(slot, rid(slot)) * nOf(slot);
    const mo = physOf("motor", rid("motor")),
          ba = physOf("battery", rid("battery")),
          pp = physOf("propulsion", rid("propulsion"));
    const packWh = (ba.S ? ba.S*3.7 * ba.mAh/1000 : 0) * nBatt;   // parallel packs → capacity ×N
    // Battery↔motor coupling. A DC motor's free speed ∝ V (Kv) and its stall
    // torque ∝ V (Kt·V/R), so more cells make it spin faster AND push harder.
    // Nameplate rpm/τ are quoted at the stock 3S pack, so stock is unchanged.
    const V_REF = 3*3.7;                       // 3S nominal (stock reference)
    const packV = (ba.S||3) * 3.7;             // pack nominal voltage
    // A real motor has a usable voltage band — you don't run a 3S motor on 6S for
    // free double performance. So the coupling is real but with diminishing returns.
    const V_COUPLE = 0.5;
    const vScale = 1 + V_COUPLE * (packV/V_REF - 1); // 3S→1.0, 4S→1.17, 6S→1.5
    const fMotor = 2*mo.tau*gear.push*DRIVE_EFF / pp.rWheel * vScale * nMotor; // N motors in parallel
    // Coulomb friction with a static/kinetic split on a surface of its own μ.
    // The tyre value is the KINETIC coeff (what a spinning wheel delivers);
    // static peak sits above it. Effective grip = tyre × arena. N = m·g.
    const N = massKg * G_ACCEL;
    const muK = pp.mu * DOHYO_MU;              // kinetic (spinning) — the old single μ
    const muS = pp.mu * DOHYO_MU / KINETIC_RATIO; // static peak (headroom)
    const gripKN = muK * N, gripSN = muS * N;
    const pushN  = Math.min(fMotor, gripKN);  // full-throttle operating force (display)
    const bal = physOf("ballast", rid("ballast"));
    return {
      massKg, torqueNm: mo.tau*nMotor, powerKW: mo.P/1000*nMotor, packWh, mu: pp.mu, packV, vScale, nMotor, nBatt,
      pushN, gripKN, gripSN, fMotor, muK, muS, tractionLimited: fMotor > gripSN,
      vmax: mo.rpm*gear.spd/60 * 2*Math.PI * pp.rWheel * vScale,  // free speed ∝ V (Kv)
      cogFactor: 1 + (bal.cog || 0),                          // low CoG resists flipping
    };
  }

  function derivedStats(build){
    const c = CHASSIS[build.chassis], p = POWER[build.power];
    const pr = build.parts || {};
    const nOf = (slot)=> (build.counts && STACKABLE[slot]) ? Math.max(1, build.counts[slot]|0) : 1;
    const g = (type)=>partOf(type, pr[type]);
    const mo=g("motor"), ba=g("battery"), pp=g("propulsion"), ar=g("armor"),
          cp=g("cpu"), sw=g("software"), ls=g("ballast"), sn=g("sensors"),
          sr=g("srimech"), ko=g("cooling"), w1=g("weapon1"), w2=g("weapon2");
    // STAGE 2a: mass is now the real bottom-up assembled mass (kg) from the
    // physical bank — it feeds inertia, the anchor, and collisions. The old
    // per-part sim masses are retired. Drive force/top-speed stay tuned until 2a-bis.
    // STAGE 2a-bis: drive force, top speed and the anchor are now derived from
    // the physical bank. push = min(motor force, μ·m·g) — grip-limited torque is
    // wasted, exactly as in reality. Constants pinned so stock RUSTY is unchanged.
    const ph = physStats(build);            // S20 : UN seul calcul (il était fait deux fois)
    const weight = ph.massKg;
    const K_FORCE = 47.0, K_SPEED = 56.0;   // P-MASSE : ×2.7 (masses réelles) — même feel
    return {
      speed: ph.vmax * K_SPEED, push: ph.pushN * K_FORCE,
      gripAnchor: ph.gripKN * K_FORCE,                 // anchor = kinetic (sustained slide)
      /* E3b — l'usure mord : build.eff = {motor,battery,propulsion} ∈ [0,1],
         calculé par l'app depuis les instances (HS = 0). Défaut 1 partout. */
      fMotorForce: ph.fMotor * K_FORCE * ((build.eff&&build.eff.motor) ?? 1),
      gripS: ph.gripSN * K_FORCE * ((build.eff&&build.eff.propulsion) ?? 1),
      gripK: ph.gripKN * K_FORCE * ((build.eff&&build.eff.propulsion) ?? 1),
      leverage: c.leverage + ar.leverage,
      traction: ph.mu, // display/grip proxy only; the physics use the grip caps
      energy: ph.packWh * 9.0 * (c.battery/130) * ((build.eff&&build.eff.battery) ?? 1), weight,
      cpuInterval: cp.interval, turnGain: cp.gain, aimNoise: sn.noise,
      selfRight: c.selfRight * sr.srMul, hasSrimech: sr.id !== "r0", drainMul: ko.drain * nOf("motor") / Math.max(1, nOf("cooling")),
      edgePush: !!sw.edgePush, escape: !!sw.escape, cogFactor: ph.cogFactor,
      /* S29 — pilote résolu depuis le palier logiciel (données SOFTWARE). */
      arbiter: swOf(build).arbiter,
      reflexes: swOf(build).modules.map(id => MODULE_BY_ID[id]).filter(mo => mo && mo.reflex),
      planifies: swOf(build).modules.map(id => MODULE_BY_ID[id]).filter(mo => mo && !mo.reflex),
      /* S24 — deux chiffres LISIBLES pour l'atelier et la boutique :
         hullFactor = ténacité de la matière ; integrity = intégrité absolue
         (ce que la barre de santé consommera au chantier armes). */
      hullFactor: hullOf(build.chassis||"boxy"),
      integrity: 300 * weight * hullOf(build.chassis||"boxy"),
      guard: pp.guard || 0,          // S24-ROUES : protection apportée par le train roulant
    };
  }
  function statBars(build){
    const s = derivedStats(build);
    return {
      speed: clamp((s.speed-60)/110,0,1), push: clamp((s.push-70)/155,0,1),
      leverage: clamp((s.leverage-0.6)/2.0,0,1), traction: clamp((s.traction-0.7)/0.7,0,1),
      energy: clamp((s.energy-60)/80,0,1),
    };
  }

  const ARENA_R = 150, TICK = 1/60, SUDDEN_DEATH_T = 20, SHRINK_RATE = 0.09, MIN_R = 20;
  /* E3 — seuils de dégâts : en dessous de HIT_J un contact ne compte pas ;
     au-delà de RIPOFF_J sur un composant EXPOSÉ (= qui a un collider), il est
     arraché net. DIRECT_MUL surpondère le choc direct dans l'intégrité. */
  const HIT_J = 70, RIPOFF_J = 260, DIRECT_MUL = 2.2, HIT_COOLDOWN = 0.22;  // P-MASSE : impulsions ∝ masse
  /* HIT_J au-dessus du bruit de POUSSÉE (le grind sumo génère ~12-20 par tick
     en appui continu) ; le temps réfractaire par bot fait qu'un contact
     prolongé compte comme UN choc, pas comme soixante. */
  // deterministic flip model (2b): lift accumulates from leverage × shove,
  // resisted by stability (mass × low CoG). No RNG.
  const LIFT_FLOOR = 2.3, LIFT_GAIN = 0.5, LIFT_DECAY = 8.0, FLIP_K = 17.0, LEVER_CAP = 1.5, BEACH_KO = 5.0;

  function makeBot(id, build, pos, angle){
    const c = CHASSIS[build.chassis], st = derivedStats(build);
    return {
      id, build, chassis:c,
      pos:{...pos}, angle, vel:{x:0,y:0}, angVel:0,
      maxSpeed:st.speed, push:st.push, mass:st.weight, gripAnchor:st.gripAnchor,
      fMotorForce:st.fMotorForce, gripS:st.gripS, gripK:st.gripK, slipping:false, slipAmt:0,
      radius:c.radius, leverage:st.leverage, traction:st.traction,
      colliders:(build.colliders&&build.colliders.list)||null,
      colliderBound:(build.colliders&&build.colliders.bound)||c.radius, gone:null,
      battery:st.energy, batteryMax:st.energy,
      decideEvery:st.cpuInterval, turnGain:st.turnGain, aimNoise:st.aimNoise,
      selfRight:st.selfRight, hasSrimech:st.hasSrimech, drainMul:st.drainMul, edgePush:st.edgePush, escape:st.escape,
      cogFactor:(typeof build.stability==="number"?build.stability:st.cogFactor), lift:0, beachedT:0,
      mode:"stalk", modeChanged:false, dominatedT:0, contactT:0,
      flippedT:0, flipAccT:0, throttleL:0, throttleR:0, edgeTime:0,
      /* E3 — dégâts positionnels : hits = journal des chocs subis
         ({t, impulse, part: MON composant frappé directement ou null=coque,
           ripped: arraché net}), hp = intégrité structurelle 0..1 (barre S9),
         hpPool ∝ masse. gone[slot] retire collider + contribution. */
      /* S24 : l'intégrité tient compte de la MATIÈRE de la coque, plus de la
         seule masse. hullFactor 1,00 = acier (comportement historique). */
      hits:[], hp:1, hpPool: 300*st.weight*hullOf(build.chassis||"boxy"), hullFactor: hullOf(build.chassis||"boxy"),
      guard: st.guard || 0,
      /* S29 — le pilote est monté au bot : son arbitre et sa liste de modules
         viennent du LOGICIEL embarqué, résolus une fois pour toutes ici. */
      arbiter: st.arbiter, reflexes: st.reflexes, planifies: st.planifies,
    };
  }

  function makeMatch(seed, buildA, buildB, opts){
    /* S16-SCALE — le ring n'est plus universel : opts.arenaR (unités) vient
       des DONNÉES (CLASS_RING de la classe du concours). Défaut = ARENA_R
       historique (150 u = 145 cm) pour compat harness/headless. Le spawn et
       la référence mort-subite suivent le ring, pas la constante. */
    opts = opts || {};
    const R = opts.arenaR || ARENA_R;
    const rng = makeRng(seed);
    const yA = (rng()-0.5)*R*0.29, yB = (rng()-0.5)*R*0.29;
    const aA = (rng()-0.5)*0.7, aB = (rng()-0.5)*0.7;
    const bots = [
      makeBot(0, buildA, {x:-R*0.47,y:yA}, 0 + aA),
      makeBot(1, buildB, {x: R*0.47,y:yB}, Math.PI + aB),
    ];
    /* ══ S22-ÉQUITÉ — les phases ne sont plus indexées sur le CÔTÉ. Le tremblé
       de visée valait sin(t*5.3 + bot.id*2.7) : à t=0 le bot 0 visait juste
       (sin 0 = 0) et le bot 1 visait à côté (sin 2,7 = 0,43). Sur un ring où la
       charge d'ouverture décide du match, c'était un cadeau permanent au bot 0
       — c'est-à-dire au JOUEUR, toujours à gauche. Même chose pour la cadence
       de décision, décalée de bot.id*3 ticks.
       Les deux phases sont désormais TIRÉES par bot : elles restent décorrélées
       (deux bots ne pensent pas au même tick, ne tremblent pas ensemble) mais
       aucune des deux ne dépend du côté. ══ */
    for (const bot of bots){
      bot.noisePhase = rng() * Math.PI * 2;
      bot.thinkPhase = Math.floor(rng() * Math.max(1, bot.decideEvery));
      /* Chaque bot a son PROPRE flux d'aléa. Avec un flux partagé, le bot 0
         tirait toujours avant le bot 1 : les deux ne recevaient jamais des
         nombres de même rang, et l'ordre de tirage redevenait un attribut du
         côté. Bénéfice annexe pour le match-témoin à venir : le compte de
         tirages devient par bot, indépendant de l'ordre de la boucle. */
      bot.rng = makeRng((seed >>> 0) ^ Math.imul(0x9E3779B9, bot.id + 1));
    }
    /* S16-ENDGAME — le plancher du cercle dépend des BOTS : la cage finale
       doit rester un duel de poussée (les deux coques pressées l'une contre
       l'autre y tiennent tout juste), jamais un concours de centre
       géométrique. 0,85×(rA+rB), plancher historique 20 conservé en butée. */
    const minR = Math.max(MIN_R, (bots[0].radius + bots[1].radius) * 0.85);
    return {
      seed, rng, t:0, arenaR:R, arenaR0:R, minR, floorT:0, over:false, winner:null, reason:null,
      bots,
      events:[],
      duels:[0,0],
      n:0, // tick counter (CPU decision cadence)
    };
  }

  /* ══════════════════════════════════════════════════════════════════════
     S27-BUS — LE BUS DE PERCEPTION.

     `control()` faisait trois choses mélangées. Elles sont désormais séparées,
     SANS RIEN CHANGER AU COMPORTEMENT (200 matchs témoins rejoués au tick
     près, tirages d'aléa par bot compris) :

         control(bot, foe, m):
             P = perceive(bot, foe, m)     1. PERCEVOIR → signaux
             D = decide(bot, P, m)         2. DÉCIDER   → { mode }
             actuate(bot, D, P, m)         3. ACTIONNER → throttleL/R

     C'est l'étape 1 des contrats : elle est RÉVERSIBLE et ne prétend rien
     améliorer. La cascade de `decide` est le code d'origine, déplacé, pas
     réécrit — c'est elle que l'arbitre remplacera à l'étape suivante.

     Deux invariants tenus, et vérifiés par le témoin :
       — l'ORDRE et le NOMBRE de tirages d'aléa sont identiques. En clair :
         `escape` et `hold` sortent avant le tremblé de conduite et ne tirent
         RIEN ; tout autre mode tire exactement deux fois, dans actuate.
       — `bot.mode`, `bot.modeChanged` et `bot.orbitT` sont écrits par `decide`,
         au même moment qu'avant (d'autres couches les lisent). ══ */

  /* perceive — le vecteur de signaux, construit UNE fois par tick.
     Il porte deux choses de nature différente, et c'est délibéré :

       • `raw` : les grandeurs géométriques d'origine (unités monde). C'est ce
         que la cascade lit aujourd'hui. Les garder telles quelles est ce qui
         rend l'étape numériquement neutre — normaliser puis dénormaliser
         introduirait des écarts de virgule flottante, et le témoin les verrait.

       • les signaux NORMALISÉS du contrat (0..1 ou -1..1), plus les bits de
         présence capteur. Personne ne les lit encore : ils existent pour que
         les modules de l'étape suivante s'y branchent sans toucher au reste.

     MASQUAGE : un signal dont le capteur est absent vaut 0, et son bit `have`
     est faux. Le masque s'applique aux signaux NORMALISÉS SEULEMENT. La
     cascade, elle, continue de lire `raw` sans masque — sinon ce ne serait
     plus un refactor mais un changement de règle du jeu déguisé en
     réorganisation. Le jour où les modules remplaceront la cascade, le masque
     deviendra effectif, et ce sera une décision assumée, mesurée. */
  const SENSOR_TIER = { n0:0, n1:1, n2:2, n3:3 };
  function perceive(bot, foe, m){
    const toFoe = V.sub(foe.pos, bot.pos);
    const distF = V.len(toFoe);
    const distEdge = m.arenaR - V.len(bot.pos);
    const facing = V.fromAngle(bot.angle);
    const foeEdgeD = m.arenaR - V.len(foe.pos);
    const R0 = m.arenaR0 || ARENA_R;

    /* Le palier de capteur du bot. Dérivé du build, jamais stocké : ajouter un
       capteur au catalogue suffit, rien à tenir à jour ici. */
    const sid = (bot.build.parts && bot.build.parts.sensors) || "n0";
    const tier = SENSOR_TIER[sid] != null ? SENSOR_TIER[sid] : 0;
    const have = { n0:true, n1:tier >= 1, n2:tier >= 2, n3:tier >= 3 };
    const gate = (ok, v) => ok ? v : 0;

    const foeSpeed = Math.hypot(foe.vel.x, foe.vel.y);
    const ownSpeed = Math.hypot(bot.vel.x, bot.vel.y);
    const nToFoe = distF > 1e-9 ? V.scl(toFoe, 1/distF) : {x:1,y:0};
    const relV = V.sub(foe.vel, bot.vel);

    return {
      /* — géométrie brute : ce que la cascade consomme — */
      raw: { toFoe, distF, distEdge, facing, foeEdgeD,
             guard: GUARD[bot.build.edgeGuard] * (m.arenaR0 ? m.arenaR0/ARENA_R : 1),
             caged: m.arenaR < (bot.radius + foe.radius) * 1.6,
             think: ((m.n + (bot.thinkPhase||0)) % bot.decideEvery) === 0 },

      /* — signaux libres (aucun capteur requis) — */
      shrink:     R0 ? m.arenaR / R0 : 1,
      battery:    bot.batteryMax ? bot.battery / bot.batteryMax : 0,
      ownSpeed:   bot.maxSpeed ? clamp(ownSpeed / bot.maxSpeed, 0, 1) : 0,
      dominatedT: clamp((bot.dominatedT||0) / 0.35, 0, 1),

      /* — n0 pare-chocs — */
      contact:     gate(have.n0, bot.contactT > 0 ? 1 : 0),
      contactSide: gate(have.n0, Math.sign(V.dot(V.perp(facing), nToFoe))),

      /* — n1 télémètre — */
      /* pushOut — l'AXE DE POUSSÉE, le signal qui manquait. +1 : pousser
         l'adversaire l'envoie droit vers SON bord. -1 : c'est moi que la
         poussée déporte vers le mien. Un duel de sumo se gagne surtout là :
         charger n'a pas la même valeur selon l'orientation du dohyo. */
      pushOut:    gate(have.n1, (() => { const fl = V.len(foe.pos);
                    return fl > 1e-6 ? clamp(V.dot(nToFoe, V.scl(foe.pos, 1/fl)), -1, 1) : 0; })()),
      foeRange:   gate(have.n1, R0 ? clamp(distF / R0, 0, 1) : 0),
      foeBearing: gate(have.n1, angNorm(Math.atan2(toFoe.y, toFoe.x) - bot.angle) / Math.PI),
      myEdge:     gate(have.n1, R0 ? clamp(distEdge / R0, 0, 1) : 0),

      /* — n2 vision — */
      foeHeading: gate(have.n2, angNorm(foe.angle - bot.angle) / Math.PI),
      foeSpeed:   gate(have.n2, foe.maxSpeed ? clamp(foeSpeed / foe.maxSpeed, 0, 1) : 0),
      closing:    gate(have.n2, clamp(-V.dot(relV, nToFoe) / Math.max(1, bot.maxSpeed), -1, 1)),
      foeEdge:    gate(have.n2, R0 ? clamp(foeEdgeD / R0, 0, 1) : 0),
      foeDomT:    gate(have.n2, clamp((foe.dominatedT||0) / 0.35, 0, 1)),

      /* — n3 centrale inertielle (capteur pas encore au catalogue) — */
      slip:    gate(have.n3, clamp(bot.slipAmt||0, 0, 1)),
      tilt:    gate(have.n3, clamp((bot.lift||0) / FLIP_K, 0, 1)),
      yawRate: gate(have.n3, clamp((bot.angVel||0) / 6, -1, 1)),

      have, caged: m.arenaR < (bot.radius + foe.radius) * 1.6,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════
     S28-MODULES — la cascade devient des MODULES qui enchérissent.

     Étape 2 des contrats : le comportement reste IDENTIQUE (témoin vert), mais
     la décision n'est plus une suite de si/sinon — c'est un catalogue de
     modules, chacun déclarant ce qu'il consomme et ce qu'il vaut. L'arbitre
     `priority` prend le premier dont l'enchère est non nulle, dans l'ordre
     déclaré : appliqué à ces modules-ci, il reproduit exactement la cascade.
     C'est ce qui rend l'étape réversible — et c'est le point d'accroche de
     l'arbitre à UTILITÉ, qui remplacera « le premier » par « le meilleur ».

     DEUX ÉTAGES, et c'est le cœur du portage :
       • RÉFLEXES (`reflex:true`) — évalués à CHAQUE tick, hors cadence CPU.
         « Tomber entre deux pensées serait injuste » (commentaire d'origine).
         GUARD et ESCAPE en sont.
       • PLANIFIÉS — évalués seulement quand le bot PENSE (cadence `decideEvery`),
         ou en sortant d'un recentrage. Sinon le mode PERSISTE, tel quel.

     Ce qui n'est PAS fait ici, délibérément :
       — les listes de modules par palier logiciel (v0 = CHARGE, v1 = +GUARD…).
         Aujourd'hui GUARD s'applique à tous les bots ; l'attacher au logiciel
         changerait le jeu. Ce sera une décision mesurée, pas un effet de bord.
       — le REFUS d'enchérir quand un capteur manque. `needs` est DÉCLARÉ et
         vérifié par la porte (les noms existent bien dans le bus), mais pas
         encore contraignant : l'imposer maintenant retirerait des modules aux
         bots en n0 et changerait leur comportement. Même raison qu'au masquage
         de S27 — on prépare, on ne bascule pas en douce. ══ */

  /* tactique — le contexte partagé d'une décision, calculé UNE fois, comme
     dans le code d'origine. Les modules le lisent au lieu de recalculer
     chacun leur coin : recalculer serait l'occasion rêvée d'une divergence. */
  function tactique(bot, foe, m, P){
    const { toFoe, distF, distEdge, facing } = P.raw;
    const strat = bot.build.strategy || "adaptive";
    const chargeD = CHARGE[bot.build.chargeDist];
    let want = distF < chargeD, orbite = false, statue = false;
    // GRAND STRATEGY — the meta layer the tactical params fit into:
    //  pressure: relentless forward pressure (always willing to charge)
    //  counter:  refuse the first engagement; strike only when the foe is
    //            committed to a charge (fast and closing) or exposed side-on
    //  ambush:   sit STILL (statue) until the foe is close, then burst
    if (strat === "pressure") want = true;
    else if (strat === "counter"){
      const foeV = Math.hypot(foe.vel.x, foe.vel.y);
      const foeSideOn = Math.abs(V.dot(V.fromAngle(foe.angle), V.norm(toFoe))) < 0.45;
      const foeSpent  = foeV < 25 && distF < chargeD;      // punish the whiff
      const sd = m.arenaR < m.arenaR0 - 1;                 // sudden death: waiting stopped paying
      const stale = (bot.orbitT||0) > 5;                   // …or the foe refuses to commit
      if (!(sd || stale)){
        want = want && (foeSideOn || foeSpent || foe.dominatedT > 0.1);
        if (!want) orbite = true;                          // matador: keep circling
      }
    } else if (strat === "ambush"){
      if (distF > chargeD * 0.55){ statue = true; want = false; }
      else want = true;
    }
    if (want){
      const ag = bot.build.aggression;
      if (ag === "fierce") { /* always */ }
      else if (ag === "balanced"){
        const align = V.dot(facing, V.norm(toFoe));
        want = align > 0.4;
      } else {
        const foeEdge = m.arenaR - V.len(foe.pos);
        const foeFacesMe = V.dot(V.fromAngle(foe.angle), V.norm(V.sub(bot.pos,foe.pos)));
        want = (foeEdge < distEdge*0.75) || (foeFacesMe < 0.1);
      }
    }
    /* Les trois issues planifiées sont mutuellement exclusives PAR
       CONSTRUCTION : `orbite` et `statue` posent want = false, donc jamais de
       conflit avec la charge. L'ordre de priorité ci-dessous est donc lisible
       sans être piégeux. */
    /* Pour l'arbitre à UTILITÉ, l'agressivité cesse d'être une porte binaire
       pour devenir un POIDS sur l'enchère : c'est là que vit la richesse
       paramétrique promise par la spec. `portee` est la porte minimale
       (l'adversaire est-il à distance d'engagement), sans le filtre
       d'alignement que la cascade applique en dur. */
    return { want, orbite, statue, chargeD,
             portee: distF < chargeD,
             poids: bot.build.aggression === "fierce" ? 1.30
                  : bot.build.aggression === "cautious" ? 0.70 : 1.00 };
  }

  /* Un module : { id, mode, reflex?, needs, bid }. `bid` ne mute RIEN et
     retourne 0 (inapplicable) ou une valeur d'utilité. En arbitre `priority`,
     seul « non nul » compte ; les valeurs prendront leur sens en `utility`. */
  const MODULES = [
    /* — RÉFLEXES : hors cadence, tous les ticks — */
    { id:"GUARD", mode:"recenter", reflex:true, needs:["myEdge"],
      /* Ne pas lâcher une poussée gagnante pour aller se recentrer : si
         l'adversaire est dominé ET plus près du bord que moi, on finit. */
      bid(bot, foe, m, P){
        const { distF, distEdge, foeEdgeD, guard, caged } = P.raw;
        const finishing = distF < (bot.radius + foe.radius) * 1.25
          && foe.dominatedT > 0.12 && foeEdgeD < distEdge;
        return (distEdge < guard && !finishing && !caged) ? 1 : 0;
      } },
    { id:"ESCAPE", mode:"escape", reflex:true, needs:["dominatedT","contact"],
      // software v3: when overpowered in a shove, don't just take it — break contact.
      bid(bot, foe, m, P){
        const { distF } = P.raw;
        return (bot.escape && bot.dominatedT > 0.3
                && distF < (bot.radius + foe.radius) * 1.35) ? 1 : 0;
      } },

    /* — PLANIFIÉS : sous cadence CPU, ordre = priorité — */
    /* Les PORTES (le `? :`) sont celles de la cascade et ne bougent pas :
       l'arbitre `priority` ne regarde que « non nul », donc son comportement
       est inchangé. Ce qui change, c'est la VALEUR rendue quand la porte est
       ouverte — elle devient une utilité, et c'est elle que `utility` compare. */
    { id:"CHARGE", mode:"charge", needs:["foeRange","foeBearing"],
      bid(bot, foe, m, P, C){
        const align = Math.max(0, 1 - Math.abs(P.foeBearing));
        /* En PRIORITÉ (v0-v2) : la porte de la cascade, inchangée au tick près.
           En UTILITÉ (v3) : la porte tombe à « il est à portée », et tout le
           reste — alignement, axe de poussée, vulnérabilité, tempérament —
           devient une VALEUR que les autres modules peuvent battre. C'est ça,
           le saut : le pilote ne suit plus une règle, il compare des options. */
        if (bot.arbiter !== "utility") return C.want ? (0.45 + 0.35*align) : 0;
        if (!C.portee) return 0;
        /* DÉGRADATION INTENTIONNELLE. Un signal masqué vaut 0, et 0 a un sens
           trompeur : un gisement nul veut dire « droit devant », pas
           « je ne sais pas ». Un bot sans télémètre se croirait donc
           parfaitement aligné en permanence — il gagnerait par accident.
           Quand le capteur manque, le module substitue une valeur NEUTRE et
           assume de décider sans information : dégradé, pas hallucinant. */
        const vu    = P.have.n1 ? align : 0.5;
        const axe   = P.have.n1 ? Math.max(0, P.pushOut) : 0.5;
        const proie = P.have.n2 ? P.foeDomT : 0;
        return C.poids * (0.10 + 0.35*vu + 0.35*axe + 0.20*proie);
      } },
    { id:"HOLD", mode:"hold", needs:["foeRange"],
      bid(bot, foe, m, P, C){
        if (!C.statue) return 0;
        // l'embuscade vaut moins quand le cercle se referme : on ne peut plus attendre
        return 0.40 + 0.35*P.shrink;
      } },
    { id:"ORBIT", mode:"orbit", needs:["foeRange","foeBearing"],
      bid(bot, foe, m, P, C){
        if (!C.orbite) return 0;
        // tourner vaut d'autant plus qu'il fonce sur nous : le manqué est l'ouverture
        return 0.40 + 0.30*Math.max(0, P.closing);
      } },
    /* — MODULES MESURÉS NÉGATIFS, tenus hors de toute liste de palier. Ils
         restent au catalogue pour ce qu'ils documentent : la tentative, et
         pourquoi elle a échoué. PATIENCE mappe sur `recenter`, qui RECULE —
         or dans cette physique céder du terrain fait perdre ; avec eux, v3
         tombe de 69 % à 64 % contre v2 (n2, 100 matchs). FEINT, lui, ne s'est
         jamais déclenché : sa fenêtre (closing ≥ 0,25 ET portée 0,06-0,35)
         ne s'ouvre pas. À reprendre avec un mode qui n'abandonne pas le
         terrain, et une fenêtre mesurée — pas à rétablir tels quels. — */
    { id:"PATIENCE", mode:"recenter", needs:["shrink","myEdge","foeEdge"],
      /* Quand le cercle se referme, la position vaut plus que l'engagement :
         si je suis plus au centre que lui, attendre le fait sortir tout seul.
         C'est le module qui apprend à ne PAS charger — le contraire d'un
         réflexe, et la première fois que le pilote fait un choix négatif. */
      bid(bot, foe, m, P, C){
        if (P.shrink > 0.985) return 0;              // le cercle n'a pas commencé à mordre
        if (!P.have.n2) return 0;                    // sans vision, on ne sait pas où il est
        const avance = P.myEdge - P.foeEdge;         // > 0 : je suis plus au large que lui
        if (avance <= 0.02) return 0;
        return 0.50 + 0.40*Math.min(1, avance*4) + 0.10*(1 - P.shrink);
      } },
    { id:"FEINT", mode:"orbit", needs:["closing","foeBearing","foeRange"],
      /* Il s'est engagé et fonce : se décaler d'un axe fait manquer la charge.
         Ne vaut qu'à distance utile — collé, il n'y a plus d'axe à changer. */
      bid(bot, foe, m, P, C){
        if (!P.have.n2) return 0;
        if (P.closing < 0.25) return 0;              // il ne vient pas assez vite
        if (P.foeRange > 0.35 || P.foeRange < 0.06) return 0;
        return 0.45 + 0.35*Math.min(1, P.closing);
      } },
    /* STALK — le module par DÉFAUT. Il enchérit toujours, faiblement : c'est
       lui qui garantit qu'un bot a un mode même sans capteur et sans module
       applicable. Sans défaut, un bot entièrement masqué n'aurait aucune
       décision — et un arbitre sans issue est un bot immobile. */
    { id:"STALK", mode:"stalk", needs:[], defaut:true,
      bid(){ return 0.40; } },
  ];
  const MODULE_BY_ID = {}; for (const mo of MODULES) MODULE_BY_ID[mo.id] = mo;

  /* SOFTWARE — ce que chaque palier logiciel SAIT faire : son arbitre et sa
     liste de modules. L'ORDRE de la liste EST la priorité pour `priority`, et
     départage les égalités pour `utility`. C'est une donnée, pas un accident.
     s0-s2 portent la liste historique : leur comportement ne bouge pas d'un
     tick. s3 gagne l'arbitre à utilité et deux modules. */
  const BASE_MODULES = ["GUARD","ESCAPE","CHARGE","HOLD","ORBIT","STALK"];
  const SOFTWARE = {
    s0: { arbiter:"priority", modules: BASE_MODULES },
    s1: { arbiter:"priority", modules: BASE_MODULES },
    s2: { arbiter:"priority", modules: BASE_MODULES },
    s3: { arbiter:"utility",  modules: ["GUARD","ESCAPE","CHARGE","HOLD","ORBIT","STALK"] },
  };
  const swOf = (build) => SOFTWARE[(build.parts && build.parts.software) || "s0"] || SOFTWARE.s0;

  /* ARBITRES — la vraie hiérarchie du jeu. `priority` est le premier :
     premier module dont l'enchère est non nulle, dans l'ordre déclaré.
     `utility` (le meilleur au lieu du premier) et `rollout` viendront. */
  const ARBITERS = {
    priority(mods, bot, foe, m, P, C){
      for (const mo of mods){ if (mo.bid(bot, foe, m, P, C) > 0) return mo; }
      return null;
    },
    /* utility — TOUTES les enchères sont évaluées, la meilleure l'emporte.
       C'est la vraie rupture : `priority` prend la première règle applicable
       et ignore qu'une autre serait bien meilleure ; `utility` compare.
       Égalité tranchée par l'ORDRE DÉCLARÉ, jamais par l'ordre d'itération —
       sinon deux exécutions pourraient diverger. */
    utility(mods, bot, foe, m, P, C){
      let best = null, bestV = 0;
      for (const mo of mods){
        const v = mo.bid(bot, foe, m, P, C);
        if (v > bestV){ bestV = v; best = mo; }      // « > » strict = premier déclaré gagne l'égalité
      }
      return best;
    },
  };

  /* decide — même comportement qu'avant, exprimé en modules.
     Écrit bot.mode / bot.modeChanged / bot.orbitT, au même moment qu'avant. */
  function decide(bot, P, m){
    const foe = m.bots[1 - bot.id];
    const arbitre = ARBITERS[bot.arbiter] || ARBITERS.priority;
    let mode = bot.mode, modId = null;

    /* Les RÉFLEXES restent en PRIORITÉ même sous arbitre à utilité : une
       garde au bord ne se met pas aux enchères. « Tomber entre deux pensées
       serait injuste » vaut aussi pour « tomber parce qu'une charge valait
       0,02 de plus ». */
    const reflexe = ARBITERS.priority(bot.reflexes, bot, foe, m, P, null);
    if (reflexe){ mode = reflexe.mode; modId = reflexe.id; }
    // 2. PLANIFICATION — seulement quand le bot pense (ou sort d'un recentrage).
    else if (P.raw.think || bot.mode === "recenter"){
      const C = tactique(bot, foe, m, P);
      const gagnant = arbitre(bot.planifies, bot, foe, m, P, C);
      mode = gagnant ? gagnant.mode : "stalk";
      modId = gagnant ? gagnant.id : "STALK";
    }
    // 3. sinon : le mode PERSISTE entre deux pensées.

    if (mode !== bot.mode){ bot.mode = mode; bot.modeChanged = true; }
    bot.orbitT = (mode==="orbit") ? (bot.orbitT||0) + TICK : (bot.orbitT||0);
    bot.modId = modId;                    // debug : quel module a emporté le tick
    return { mode, modId };
  }

  /* actuate — la cible puis le servo. Bloc d'origine, déplacé.
     ⚠ ORDRE DES TIRAGES : `escape` et `hold` sortent AVANT le tremblé de
     conduite et ne consomment aucun aléa. Deux tirages exactement dans tous
     les autres modes. Déplacer ce tirage désynchroniserait toutes les graines
     — le témoin compte les tirages PAR BOT précisément pour ça. */
  function actuate(bot, D, P, m){
    const foe = m.bots[1 - bot.id];
    const mode = D.mode;
    const { toFoe, distF } = P.raw;
    const h = HANDLING[bot.build.handling];
    let target;
    if (mode === "escape"){
      // break contact: if reverse points to safety, floor it backward; if not,
      // PIVOT first (full differential) — backing straight into the shove only
      // keeps you pinned under the bulldozer.
      const away = V.norm(V.sub(bot.pos, foe.pos));
      const tail = V.scl(V.fromAngle(bot.angle), -1);
      const align = V.dot(tail, away);                 // is reverse pointing to safety?
      const steer = V.dot({x:-tail.y,y:tail.x}, away);
      if (align > 0.3){ bot.throttleL = -1 - steer*0.3; bot.throttleR = -1 + steer*0.3; }
      else { const sgn = steer>=0?1:-1; bot.throttleL = -sgn; bot.throttleR = sgn; } // pivot
      return;
    }
    if (mode === "orbit"){
      /* ⚠ DETTE CONNUE (constatée à l'extraction S27, PAS corrigée ici) : la
         cible calculée dans ce bloc est TOUJOURS écrasée par la branche
         `else` plus bas — mesuré 5820 fois sur 5820, de 70 unités en moyenne.
         Le mode `orbit` roule donc en réalité sur la cible de standoff.
         Corriger ici changerait le comportement : ce n'est pas le travail
         d'un refactor. À trancher devant le simulateur, avec mesure. */
      const rad = V.sub(bot.pos, foe.pos), rl = Math.max(1, V.len(rad));
      const tangent = {x:-rad.y/rl, y:rad.x/rl};
      const ring = CHARGE[bot.build.chargeDist]*0.75;
      const inout = V.scl(V.norm(rad), (ring - rl) * 0.5);     // hold the orbit radius
      target = V.add(V.add(bot.pos, V.scl(tangent, 42)), inout);
      { const cap = Math.max(m.arenaR*0.5, m.arenaR-24);           // S16-ENDGAME : jamais négatif sur petit ring
        if (V.len(target) > cap) target = V.scl(V.norm(target), cap); } // stay on the dohyo
    } else if (mode === "hold"){
      // statue: keep the nose on the foe, wheels stopped (bait + save battery)
      const aim = Math.atan2(toFoe.y, toFoe.x);
      let dA = aim - bot.angle; while(dA>Math.PI)dA-=2*Math.PI; while(dA<-Math.PI)dA+=2*Math.PI;
      const turn = Math.abs(dA) > 0.15 ? Math.sign(dA)*0.35 : 0;
      bot.throttleL = -turn; bot.throttleR = turn;
      return;
    }
    if (mode === "recenter"){
      /* S16-ENDGAME — la cible de recentrage suit le ring : 18 u fixes
         plaçaient les deux bots sur des points miroirs à distance constante
         du centre (l'oscillation du playtest). Bornée à 28% du ring, elle
         converge vers le centre quand le cercle se resserre. */
      const away = V.scl(V.norm(V.sub(bot.pos, foe.pos)), Math.min(18, m.arenaR*0.28));
      target = away;
    } else if (mode === "charge"){
      const ap = bot.build.approach;
      let useFlank = ap === "flank";
      if (ap === "opportunist"){
        const foeFacesMe = V.dot(V.fromAngle(foe.angle), V.norm(V.sub(bot.pos,foe.pos)));
        useFlank = foeFacesMe > 0.5;
      }
      if (useFlank && distF > (bot.radius + foe.radius) * 1.9){
        const side = V.perp(V.fromAngle(foe.angle));
        const s = V.dot(side, V.sub(bot.pos, foe.pos)) >= 0 ? 1 : -1;
        target = V.add(foe.pos, V.scl(side, s * (foe.radius*2.4)));
      } else if (bot.edgePush && foe.dominatedT > 0 && V.len(foe.pos) > 5
          && V.dot(V.norm(toFoe), V.norm(foe.pos)) > 0.25){
        // software v2: when the shove axis is already roughly outward,
        // steer the dominated foe toward their NEAREST edge (outward radial).
        target = V.add(foe.pos, V.scl(V.norm(foe.pos), 48));
      } else target = foe.pos;
    } else {
      const standoff = CHARGE[bot.build.chargeDist] * 1.1;
      const dir = V.norm(toFoe);
      const ring = V.sub(foe.pos, V.scl(dir, standoff));
      const orbit = V.scl(V.perp(dir), 25);
      target = V.add(ring, orbit);
    }

    const j = h.jitter;
    const rnd = bot.rng || m.rng;                    // S22 : flux propre au bot
    target = V.add(target, {x:(rnd()-0.5)*2*j*180, y:(rnd()-0.5)*2*j*180});

    const want = V.sub(target, bot.pos);
    let wantAng = Math.atan2(want.y, want.x);
    // sensor quality: cheap sensors = wandering aim (deterministic wobble).
    // Damped at close range: in contact you FEEL the foe, sensors matter at distance.
    const rangeF = clamp(distF/110, 0.35, 1);
    wantAng += bot.aimNoise * 0.12 * rangeF * Math.sin(m.t*5.3 + (bot.noisePhase||0));
    const err = angNorm(wantAng - bot.angle);
    const turn = clamp(err * 3.0 * bot.turnGain, -1, 1);
    let fwd = clamp(Math.cos(err) * 1.4, -0.25, 1);
    if (mode === "charge") fwd = Math.max(fwd, 0.85);
    bot.throttleL = clamp(fwd - turn, -1, 1);
    bot.throttleR = clamp(fwd + turn, -1, 1);
  }

  function control(bot, foe, m){
    const P = perceive(bot, foe, m);   // 1. PERCEVOIR
    const D = decide(bot, P, m);       // 2. DÉCIDER
    actuate(bot, D, P, m);             // 3. ACTIONNER
    bot.P = P;                         // dernier vecteur lu (debug, modules à venir)
  }

  function leverageDuel(a, b, m){
    const nAB = V.norm(V.sub(b.pos, a.pos));
    function score(me, other, nToOther){
      const facing = V.fromAngle(me.angle);
      const align = Math.max(0.3, V.dot(facing, nToOther));
      const otherFacing = V.fromAngle(other.angle);
      const flank = V.dot(otherFacing, V.scl(nToOther,-1)) < 0.2 ? 1.5 : 1.0;
      return me.leverage * align * flank;
    }
    let sA = score(a,b,nAB), sB = score(b,a,V.scl(nAB,-1));
    if (b.dominatedT > 0 && b.wasDominatedBy === a.id) sA *= 1.45;
    if (a.dominatedT > 0 && a.wasDominatedBy === b.id) sB *= 1.45;
    let winner=null, loser=null, ratio=1;
    if (sA > sB*1.15){ winner=a; loser=b; ratio=sA/sB; }
    else if (sB > sA*1.15){ winner=b; loser=a; ratio=sB/sA; }
    if (winner){
      loser.dominatedT = 0.35;
      if (loser.wasDominatedBy !== winner.id){
        loser.wasDominatedBy = winner.id;
        winner.wasDominatedBy = -1;
        m.duels[winner.id]++;
        m.events.push({t:m.t, type:"duel", winner:winner.id});
      }
      // deterministic flip: lift builds from leverage advantage × the winner's
      // shove, every tick the clinch holds. It's resisted by the loser's stability
      // (mass × low centre of gravity — ballast helps). Past threshold, it goes over.
      const shove = Math.max(0, (winner.throttleL + winner.throttleR) * 0.5);
      const lever = Math.min(LEVER_CAP, Math.max(0, ratio - LIFT_FLOOR));
      // low CoG (ballast) resists BOTH ways: slower lift build AND higher threshold.
      loser.lift = (loser.lift || 0) + lever * (0.35 + shove) * LIFT_GAIN / loser.cogFactor;
      const threshold = FLIP_K * loser.mass * loser.cogFactor;
      if (loser.lift >= threshold && loser.flippedT <= 0){
        // a srimech is REQUIRED to get back over; without one, the flip is
        // terminal — you stay beached until you lose by attrition.
        loser.flippedT = loser.hasSrimech ? loser.selfRight : 1e9;
        loser.lift = 0;
        m.events.push({t:m.t, type:"flip", bot:loser.id});
      }
    }
  }

  function tick(m){
    m.n++;
    if (m.over) return;
    const dt = TICK;
    const [a,b] = m.bots;

    if (m.t > SUDDEN_DEATH_T && m.arenaR > (m.minR || MIN_R))
      m.arenaR = Math.max((m.minR || MIN_R), m.arenaR * (1 - SHRINK_RATE*dt));

    /* ══ S22-ÉQUITÉ — PASSE 1 : DÉCISION. Tous les bots décident sur le MÊME
       état de début de tick. Avant, la boucle décidait ET intégrait bot par
       bot : le bot 1 lisait donc la position, la vitesse et l'angle que le
       bot 0 venait d'écrire dans CE tick, tandis que le bot 0 avait décidé sur
       l'état du tick précédent. Un tick d'information fraîche, systématique,
       toujours du même côté. Le joueur étant TOUJOURS le bot 0, il payait ce
       retard à chaque combat. Mesuré au miroir : jusqu'à ±25 points en
       classe S, où le petit ring amplifie tout. ══ */
    for (const bot of m.bots){
      bot.modeChanged = false;
      if (bot.flippedT > 0) bot.throttleL = bot.throttleR = 0;  // sur le dos : pas de commande
      else control(bot, m.bots[1-bot.id], m);
    }

    // PASSE 2 — INTÉGRATION : la physique, une fois toutes les décisions prises.
    for (const bot of m.bots){
      if (bot.flippedT > 0){
        bot.flipAccT += Math.min(dt, bot.flippedT);  // cumul réel du temps passé retourné
        bot.flippedT -= dt;
        bot.beachedT = (bot.beachedT || 0) + dt; // cumulative time on your back (attrition)
        if (bot.flippedT <= 0 && m.t > 0) m.events.push({t:m.t, type:"righted", bot:bot.id});
      }

      const use = (Math.abs(bot.throttleL)+Math.abs(bot.throttleR)) * 0.5;
      bot.battery = Math.max(0, bot.battery - use * 3.2 * bot.drainMul * dt);
      const frac = bot.battery / bot.batteryMax;
      // voltage sag: a LiPo droops under load and as it depletes, so the motor
      // loses rpm and torque late in the fight (physical power fade).
      const powerScale = Math.min(1, 0.45 + frac*1.1);

      const dom = bot.dominatedT > 0 ? 0.6 : 1.0;
      bot.dominatedT = Math.max(0, bot.dominatedT - dt);
      bot.lift = Math.max(0, (bot.lift || 0) - LIFT_DECAY * dt); // recover when not out-levered

      const facing = V.fromAngle(bot.angle);
      const drive = (bot.throttleL + bot.throttleR) * 0.5;
      const turnCmd = (bot.throttleR - bot.throttleL) * 0.5;
      const h = HANDLING[bot.build.handling];

      // Motor torque–speed curve: a DC motor's torque falls linearly from stall
      // (at rest) to zero at free speed. So drive force tapers as the bot nears
      // its top speed — top speed now EMERGES from the physics, not a hard cap.
      const vDrive = V.dot(bot.vel, facing) * Math.sign(drive||1);      // speed in the drive direction
      const speedFrac = Math.max(0, 1 - Math.max(0, vDrive) / (bot.maxSpeed * VFREE_K));
      // Coulomb traction: the motor demands F = fMotor·throttle·(torque-speed), but
      // the floor only transmits up to μ·N. Past the STATIC peak the wheels break
      // loose and spin (kinetic, lower) — real wheelspin, with hysteresis.
      const demanded = bot.fMotorForce * speedFrac * Math.abs(drive);
      if (!bot.slipping && demanded > bot.gripS) bot.slipping = true;
      else if (bot.slipping && demanded < bot.gripK) bot.slipping = false;
      const effGrip = bot.slipping ? bot.gripK : bot.gripS;
      const forceMag = Math.min(demanded, effGrip);
      bot.slipAmt = bot.slipping ? Math.min(1, (demanded - bot.gripK) / bot.gripK) : 0;

      const accel = (forceMag / bot.mass) * 2.0 * powerScale * dom;
      bot.vel = V.add(bot.vel, V.scl(facing, Math.sign(drive) * accel * dt));

      const fwdSpd = V.dot(bot.vel, facing);
      const latV = V.sub(bot.vel, V.scl(facing, fwdSpd));
      const damp = Math.pow(h.latDamp, dt*60);
      bot.vel = V.add(V.scl(facing, fwdSpd), V.scl(latV, damp));

      // drag instead of hard cap: self-drive tops out at maxSpeed, but external
      // shoves CAN exceed it — heavy torque bots are planted, light speed bots fly.
      // traction is part of the anchor: soft tires = harder to shove around.
      // a DOMINATED bot loses its anchor: that's what winning the leverage duel buys you.
      // a FLIPPED bot is dead weight on the floor — hard to shove out while it recovers,
      // so a flip is a tempo loss (can't drive), not a free ring-out.
      const anchor = bot.flippedT > 0 ? 2.0 : (bot.dominatedT > 0 ? 0.45 : 1);
      const kDrag = (bot.gripAnchor * anchor / bot.mass * 2.415) / bot.maxSpeed;
      bot.vel = V.scl(bot.vel, 1/(1 + kDrag*dt));

      bot.angVel = turnCmd * h.turnMax * dom * (bot.flippedT>0 ? 0 : 1);
      bot.angle += bot.angVel * dt;

      if (bot.flippedT > 0) bot.vel = V.scl(bot.vel, Math.pow(0.9, dt*60));

      bot.pos = V.add(bot.pos, V.scl(bot.vel, dt));

      // analytics for the debrief
      if (m.arenaR - V.len(bot.pos) < 32) bot.edgeTime += dt;
    }

    const d = V.sub(b.pos, a.pos);
    const dist = V.len(d);
    // Per-component collision: the deepest overlapping pair of tagged circles.
    // Colliders hug what's drawn (hull + protruding wheels/weapons). Torn-off
    // parts (bot.gone) drop out live. Falls back to a single circle if unset.
    let hit=null;
    if (a.colliders && b.colliders){
      if (dist < a.colliderBound + b.colliderBound){
        const wc=(bot)=>{ const c=Math.cos(bot.angle), s=Math.sin(bot.angle);
          return bot.colliders.filter(k=>!(bot.gone&&bot.gone[k.slot]))
            .map(k=>({x:bot.pos.x+k.x*c-k.y*s, y:bot.pos.y+k.x*s+k.y*c, r:k.r, slot:k.slot})); };
        const WA=wc(a), WB=wc(b); let best=null;
        for(const ca of WA) for(const cb of WB){
          const dx=cb.x-ca.x, dy=cb.y-ca.y, dl=Math.hypot(dx,dy), minD=ca.r+cb.r;
          if(dl<minD && dl>0.001){ const ov=minD-dl;
            if(!best||ov>best.ov) best={ov, n:{x:dx/dl,y:dy/dl}, aPart:ca.slot, bPart:cb.slot}; } }
        if(best) hit={n:best.n, overlap:best.ov, aPart:best.aPart, bPart:best.bPart};
      }
    } else if (dist < a.radius + b.radius && dist > 0.001){
      hit={n:V.scl(d,1/dist), overlap:(a.radius+b.radius)-dist, aPart:null, bPart:null};
    }
    if (hit){
      const n = hit.n, overlap = hit.overlap;
      const tot = a.mass + b.mass;
      a.pos = V.add(a.pos, V.scl(n, -overlap * (b.mass/tot)));
      b.pos = V.add(b.pos, V.scl(n,  overlap * (a.mass/tot)));
      a.lastHitPart = hit.bPart; b.lastHitPart = hit.aPart; // which of MY parts struck / was struck
      a.hitOnFoe = hit.bPart; b.hitOnFoe = hit.aPart;        // foe part I contacted (for future damage)
      const relVn = V.dot(V.sub(b.vel,a.vel), n);
      if (relVn < 0){
        const e = 0.05;
        const jimp = -(1+e)*relVn / (1/a.mass + 1/b.mass);
        a.vel = V.add(a.vel, V.scl(n, -jimp/a.mass));
        b.vel = V.add(b.vel, V.scl(n,  jimp/b.mass));
        if (Math.abs(jimp) > 28) m.events.push({t:m.t, type:"impact", impulse:Math.abs(jimp),
          x:(a.pos.x+b.pos.x)/2, y:(a.pos.y+b.pos.y)/2});
        // E3 : chaque bot journalise le choc qu'il ENCAISSE, attribué à son
        // composant frappé (hit.aPart pour a, hit.bPart pour b) ou à la coque.
        const J = Math.abs(jimp);
        if (J > HIT_J){
          for (const [bot, myPart] of [[a, hit.aPart], [b, hit.bPart]]){
            if (bot._lastHitLogT != null && m.t - bot._lastHitLogT < HIT_COOLDOWN) continue;
            bot._lastHitLogT = m.t;
            const direct = myPart != null && !(bot.gone && bot.gone[myPart]);
            let ripped = false;
            if (direct && J > RIPOFF_J){
              bot.gone = bot.gone || {}; bot.gone[myPart] = true; ripped = true;
              m.events.push({t:m.t, type:"ripoff", bot:bot.id, part:myPart, impulse:J});
            }
            /* S24-ROUES — la protection est POSITIONNELLE : elle n'agit que
               sur les chocs reçus PAR la roue. Une roue blindée encaisse à la
               place du châssis ; frappé ailleurs, le bot ne gagne rien. */
            const abri = (direct && myPart === "propulsion") ? (1 - (bot.guard||0)) : 1;
            bot.hits.push({t:m.t, impulse:J, part: direct ? myPart : null, ripped});
            bot.hp = Math.max(0, bot.hp - J*abri*(direct ? DIRECT_MUL : 1)/bot.hpPool);
          }
        }
        if (Math.abs(relVn) > 55){ a.lastHardHitT = m.t; b.lastHardHitT = m.t; }
      }
      a.contactT += dt; b.contactT += dt;
      if (a.contactT > 0.1) leverageDuel(a, b, m);
      for (const bot of m.bots){
        const foe = m.bots[1-bot.id];
        const nTo = V.norm(V.sub(foe.pos, bot.pos));
        const facing = V.fromAngle(bot.angle);
        const into = Math.max(0, V.dot(facing, nTo));
        const dom = bot.dominatedT > 0 ? 0.5 : 1.0;
        const drive = Math.max(0,(bot.throttleL+bot.throttleR)*0.5);
        const f = bot.push * into * drive * dom * 1.7;
        foe.vel = V.add(foe.vel, V.scl(nTo, f/foe.mass * dt));
      }
    } else {
      a.contactT = Math.max(0, a.contactT - dt*4);
      b.contactT = Math.max(0, b.contactT - dt*4);
      if (a.contactT===0 && b.contactT===0){ a.wasDominatedBy = b.wasDominatedBy = -1; }
    }

    /* S16-ENDGAME — au plancher, plus de photo-finish instantanée « le plus
       proche du centre gagne » (elle tranchait un match au hasard de
       l'oscillation). La cage laisse 8 s de duel réel — la sortie de piste
       décide presque toujours avant ; l'arbitrage au centre ne reste que
       comme ultime recours d'un duel figé. */
    if (!m.over && m.t > SUDDEN_DEATH_T && m.arenaR <= (m.minR || MIN_R) + 0.5){
      m.floorT = (m.floorT || 0) + dt;
      if (m.floorT > 8){
        m.over = true;
        m.winner = (V.len(a.pos) < V.len(b.pos)) ? 0 : 1;
        m.reason = "shrinkOut";
        m.events.push({t:m.t, type:"end", winner:m.winner, reason:m.reason});
      }
    }

    for (const bot of m.bots){
      if (!m.over && V.len(bot.pos) > m.arenaR){
        m.over = true; m.winner = 1-bot.id;
        m.reason = m.t > SUDDEN_DEATH_T ? "shrinkOut" : "ringOut";
        m.events.push({t:m.t, type:"end", winner:m.winner, reason:m.reason});
      }
      if (!m.over && (bot.beachedT || 0) > BEACH_KO){
        // KO by attrition: flipped too long overall (one flip is a survivable
        // setback; repeated flips, or a slow self-right, end you).
        m.over = true; m.winner = 1-bot.id; m.reason = "koFlip";
        m.events.push({t:m.t, type:"end", winner:m.winner, reason:m.reason});
      }
    }
    m.t += dt;
    if (m.t > 90 && !m.over){
      m.over = true;
      m.winner = (V.len(a.pos) < V.len(b.pos)) ? 0 : 1;
      m.reason = "timeout";
    }
  }

  function runHeadless(seed, buildA, buildB){
    const m = makeMatch(seed, buildA, buildB);
    while(!m.over) tick(m);
    return { winner:m.winner, reason:m.reason, t:m.t, duels:m.duels, events:m.events,
             edgeTime:[m.bots[0].edgeTime, m.bots[1].edgeTime] };
  }

  /* ════════════════════ ÉTALONS — LIGNE CALIBRAGE ════════════════════
     Adversaires ENTIÈREMENT FIGÉS : châssis, pièces, pilote. Aucun tirage,
     aucune dépendance au niveau du joueur. C'est la règle graduée : deux
     mesures prises à un mois d'écart y sont comparables, et c'est là que la
     forme réelle d'un pilote se juge — pas au banc d'entraînement.

     Un barreau LOGICIEL par niveau (s0 · s0 · s1 · s1 · s2 aujourd'hui ;
     la table s'étendra quand v3-v5 existeront). Les pilotes sont DÉLIBÉRÉS :
     le défaut aléatoire de genOpponent (« daredevil » 60 % aux bas niveaux)
     n'a pas sa place dans un étalon.

     Tous les builds sont vérifiés par la porte : ils LOGENT dans leur coque,
     et leur classe est celle annoncée. Ne jamais les retoucher sans mesurer :
     changer un étalon invalide tout l'historique de mesures. */
  const BENCH_PARTS = (over) => Object.assign({
    propulsion:"pr0", motor:"m0", cpu:"c0", battery:"b0", sensors:"n0",
    software:"s0", armor:"a0", ballast:"l0", srimech:"r0", cooling:"k0",
    weapon1:"w0", weapon2:"x0",
  }, over || {});
  const BENCH = (name, chassis, parts, pilot) => ({
    name, build: { ...DEFAULT_BUILD, ...pilot, chassis, parts: BENCH_PARTS(parts), counts:{} },
  });
  const BENCHMARKS = {
    // ---- classe S : trois barreaux, trois coques, gamme MICRO (S24) ----
    S1: BENCH("ÉTALON S1", "tortue_s", { propulsion:"pr4" },
      { strategy:"adaptive", aggression:"balanced", edgeGuard:"normal", approach:"frontal",
        power:"mixed", chargeDist:"medium", handling:"stable" }),
    S2: BENCH("ÉTALON S2", "hex_s", { motor:"m5", propulsion:"pr6" },
      { strategy:"adaptive", aggression:"balanced", edgeGuard:"normal", approach:"frontal",
        power:"mixed", chargeDist:"medium", handling:"stable" }),
    S3: BENCH("ÉTALON S3", "coin_s", { motor:"m6", propulsion:"pr7", sensors:"n1", software:"s1" },
      { strategy:"adaptive", aggression:"fierce", edgeGuard:"normal", approach:"opportunist",
        power:"mixed", chargeDist:"medium", handling:"stable" }),
    // ---- classe M : cinq barreaux, CINQ COQUES DISTINCTES (décision Denis 26/07).
    //      L'échelle monte par le MATÉRIEL et le pilote ; la coque donne le
    //      caractère, et son ordre suit le levier (boxy 0,9 → fleche 2,2). ----
    M1: BENCH("ÉTALON M1", "boxy", {},
      { strategy:"adaptive", aggression:"balanced", edgeGuard:"normal", approach:"frontal",
        power:"mixed", chargeDist:"medium", handling:"stable" }),
    M2: BENCH("ÉTALON M2", "tortue", { motor:"m1", propulsion:"pr1" },
      { strategy:"adaptive", aggression:"balanced", edgeGuard:"normal", approach:"frontal",
        power:"mixed", chargeDist:"medium", handling:"stable" }),
    M3: BENCH("ÉTALON M3", "marteau", { motor:"m2", battery:"b1", propulsion:"pr1", cpu:"c1", sensors:"n1", software:"s1" },
      { strategy:"adaptive", aggression:"balanced", edgeGuard:"normal", approach:"opportunist",
        power:"mixed", chargeDist:"medium", handling:"stable" }),
    M4: BENCH("ÉTALON M4", "losange", { motor:"m2", battery:"b1", propulsion:"pr2", cpu:"c1", sensors:"n1", software:"s1" },
      { strategy:"adaptive", aggression:"fierce", edgeGuard:"normal", approach:"opportunist",
        power:"mixed", chargeDist:"medium", handling:"stable" }),
    M5: BENCH("ÉTALON M5", "fleche", { motor:"m3", battery:"b1", propulsion:"pr3", cpu:"c2", sensors:"n2", software:"s2" },
      { strategy:"adaptive", aggression:"fierce", edgeGuard:"normal", approach:"opportunist",
        power:"torque", chargeDist:"medium", handling:"stable" }),
  };

  /* ---------- SLICE 1: player bot, teaching, opponent generator ---------- */
  const SLICE1 = {
    // the used clunker: fixed chassis, "functional but not optimal" defaults
    playerBuild: { chassis:"boxy", strategy:"adaptive", aggression:"balanced", edgeGuard:"daredevil",
      approach:"frontal", power:"mixed", chargeDist:"medium", handling:"stable" },
    // teaching opponents recalibrated for the deterministic flip (2b). Both are
    // BOXY — same leverage class as RUSTY, so no uncounterable flip mismatch early;
    // the lessons are piloting. Wedge/fork flippers are a MID-game threat (buy srimech).
    // T1 GRIZZLI: defaults lose (~13%) — lesson: Aggression -> Fierce (commit, ~100%).
    // T2 PIKPIK: your fierce config over-commits at the rim (~18%) — lesson:
    //            Edge guard -> Normal (guard the edge while you brawl, ~100%).
    teaching: [
      { nameIdx:0, archetype:"bulldozer", build:{ chassis:"marteau", aggression:"cautious",
        edgeGuard:"fearful", approach:"frontal", power:"mixed", chargeDist:"medium", handling:"stable" }},
      { nameIdx:3, archetype:"camper", build:{ chassis:"tortue", aggression:"cautious",
        edgeGuard:"fearful", approach:"frontal", power:"mixed", chargeDist:"short", handling:"stable" }},
    ],
  };

  const OPPONENT_CHASSIS = ["fleche","marteau","tortue","losange","disque"]; // player is locked to RUSTY
  const ARCHETYPES = {
    bulldozer:{ chassis:["marteau","disque"], aggression:["fierce"], approach:["frontal"],
      power:["torque"], edgeGuard:["normal","daredevil"], chargeDist:["medium","long"], handling:["stable"] },
    mosquito:{ chassis:["fleche","losange"], aggression:["balanced","fierce"], approach:["flank"],
      power:["speed"], edgeGuard:["normal","fearful"], chargeDist:["short","medium"], handling:["nervous","drift"] },
    camper:{ chassis:["tortue","disque"], aggression:["cautious"], approach:["opportunist"],
      power:["mixed","torque"], edgeGuard:["fearful"], chargeDist:["short"], handling:["stable"] },
    wedgelord:{ chassis:["fleche","losange"], aggression:["fierce","balanced"], approach:["frontal"],
      power:["mixed","torque"], edgeGuard:["normal"], chargeDist:["medium","long"], handling:["stable","nervous"] },
    chaotic:null, // full random
  };

  function genOpponent(seed, level, opts){
    /* E7b — opts (facultatif) : contraintes de concours pour des adversaires
       LÉGAUX. { allowChassis:[ids], banTracks:bool, maxKg:number } */
    opts = opts || {};
    const rng = makeRng(seed);
    const pool = level <= 1 ? ["bulldozer","mosquito","wedgelord"]
               : level === 2 ? ["bulldozer","mosquito","wedgelord","camper"]
               : ["bulldozer","mosquito","wedgelord","camper","chaotic"];
    const arch = pool[Math.floor(rng()*pool.length)];
    const pick = (arr)=>arr[Math.floor(rng()*arr.length)];
    const build = {};
    const spec = ARCHETYPES[arch];
    build.chassis = spec ? pick(spec.chassis) : pick(OPPONENT_CHASSIS);
    if (opts.allowChassis && opts.allowChassis.length &&
        opts.allowChassis.indexOf(build.chassis) < 0)
      build.chassis = pick(opts.allowChassis);
    for (const key of Object.keys(OPTS))
      build[key] = spec && spec[key] ? pick(spec[key]) : pick(OPTS[key]);
    // low levels carry an exploitable flaw; high levels are clean
    if (level <= 2 && rng() < 0.6) build.edgeGuard = "daredevil";
    if (level <= 2) build.strategy = pick(["adaptive","pressure"]); // metas unlock with level
    // "long" charge is a first-strike auto-win in near-mirrors: locked until the
    // player has unlocked chargeDist too (balance flag, revisit later)
    if (level < 3 && build.chargeDist === "long") build.chargeDist = "medium";
    // high-level opponents come upgraded, keeping pace with the player's shop
    const tier = level >= 5 ? 3 : level >= 4 ? 2 : level >= 3 ? 1 : 0;
    /* S24-MICRO — `opts.micro` (posé par le concours quand il impose la classe S)
       fait puiser dans la gamme MICRO dès le tirage, au lieu de laisser l'app
       réparer après coup. Sans lui, l'adversaire de classe S restait au moteur
       d'origine : les gammes historiques sont des 2×2 et 3×2 qui n'entrent pas
       dans 9 cellules, et la réparation ne pouvait que dégrader. Le moteur
       n'apprend RIEN des empreintes ici — il lit un drapeau de règlement. */
    const micro = !!opts.micro;
    let motor = micro ? ["m0","m5","m6"][Math.min(2,tier)] : ["m0","m1","m2"][Math.min(2,tier)];
    if (tier >= 3) motor = micro ? "m6" : (arch==="mosquito"||arch==="chaotic") ? "m4" : "m3";
    build.parts = {
      motor,
      battery: ["b0","b1"][Math.min(1,tier)], // capped at 4S: the big bricks do not fit starter hulls
      propulsion: micro ? (tier>=3 ? "pr8" : ["pr4","pr6","pr7"][tier])
                        : (tier>=3 ? "pr3" : ["pr0","pr1","pr2"][tier]),
      armor: (level >= 4 && rng() < (level>=5 ? 0.5 : 0.35))
        ? (level>=5 ? (rng()<0.4?"a3":"a2") : (rng()<0.5?"a2":"a1")) : "a0",
      // S20 : la table s'arrête au niveau 5 ; au-delà l'index sortait du tableau
      // et retombait sur "c0" — l'adversaire le plus haut placé recevait le pire
      // processeur. On BORNE au dernier barreau au lieu de retomber au stock.
      cpu:      ["c0","c0","c1","c1","c2"][Math.min(Math.max(level,1),5)-1],
      sensors:  level>=5 ? "n2" : level>=3 ? "n1" : "n0",
      /* S29 — les adversaires montent enfin jusqu'à l'arbitrage. Ils
         plafonnaient à s1 : la fin de carrière M se jouait contre des pilotes
         d'entrée de gamme, et le joueur n'a jamais rencontré ce qu'il venait
         d'acheter. Le plafond du CONCOURS (opts.maxSoftware) prime — sans
         quoi l'adversaire aurait un logiciel que le règlement interdit au
         joueur, ce qui n'est pas une difficulté mais une tricherie. */
      software: (level>=5 && rng()<0.55) ? "s3"
              : (level>=4 && rng()<0.60) ? "s2"
              : (level>=3 && rng()<0.50) ? "s1" : "s0",
      ballast:  (arch==="bulldozer" && level>=3 && rng()<0.5) ? "l1" : "l0",
      srimech:  (level>=5 && rng()<0.3) ? (micro ? "r3" : "r1") : "r0",
      // pas de refroidisseur micro : k1 est un 2×2, il prendrait la seule
      // grande place de la coque. En micro on s'en passe, comme le joueur.
      cooling:  (!micro && level>=4 && rng()<0.35) ? "k1" : "k0",
      weapon1:"w0", weapon2:"x0",
    };
    if (opts.banTracks && build.parts.propulsion === "pr3")
      build.parts.propulsion = "pr1";
    if (opts.maxSoftware){                       // le règlement du concours prime
      const cap = PARTS.software.findIndex(p => p.id === opts.maxSoftware);
      const cur = PARTS.software.findIndex(p => p.id === build.parts.software);
      if (cap >= 0 && cur > cap) build.parts.software = PARTS.software[cap].id;
    }
    if (opts.maxKg){
      const order = [["propulsion","pr0"],["battery","b0"],["motor","m0"]];
      let guard = 0;
      while (physStats({chassis:build.chassis, parts:build.parts}).massKg > opts.maxKg && guard++ < 6){
        const hit = order.find(([sl,base]) => build.parts[sl] && build.parts[sl] !== base);
        if (!hit) break;
        build.parts[hit[0]] = hit[1];
      }
    }

    return { build, archetype:arch };
  }

  // a level's tournament: 3 fixed opponents; the final carries no flaw
  function genTournament(seed, level){
    const opps = [
      genOpponent(seed*3+1, level),
      genOpponent(seed*3+2, level),
      genOpponent(seed*3+3, level),
    ];
    if (opps[2].build.edgeGuard === "daredevil") opps[2].build.edgeGuard = "normal";
    return opps;
  }

  // honest one-word tendency, derived from the ACTUAL generated settings
  function tendencyKey(build){
    if (build.aggression === "fierce") return "tend_charger";
    if (build.approach === "flank") return "tend_circler";
    if (build.edgeGuard === "fearful") return "tend_camper";
    if (build.power === "torque") return "tend_pusher";
    if (build.aggression === "cautious") return "tend_waiter";
    return "tend_wild";
  }

  return { makeMatch, tick, DAMAGE:{HIT_J, RIPOFF_J, DIRECT_MUL}, runHeadless, derivedStats, statBars, genOpponent, genTournament, tendencyKey,
           perceive, decide, actuate,          // S27 : les trois phases, exposées pour la porte et les modules
           MODULES, ARBITERS, tactique, SOFTWARE,   // S28/S29 : modules, arbitres, paliers
           CHASSIS, OPTS, DEFAULT_BUILD, SLICE1, PARTS, partOf, ARENA_R, TICK, SUDDEN_DEATH_T,
           PHYS, physStats, partMassKg, BEAM_KG, BENCHMARKS, MATIERES, hullOf };
})();
// ENGINE-END
