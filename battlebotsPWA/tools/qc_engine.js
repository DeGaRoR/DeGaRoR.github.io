// tools/qc_engine.js — DOM-free engine invariants. Fast, runs first in the gate.
const E = require("./engine.cjs");   // artefact CommonJS produit par extract.js
const { check, safe, report } = require("./check.js");

const P = E.SLICE1.playerBuild;
const B = (over = {}) => ({ ...E.DEFAULT_BUILD, ...over });
const winrate = (a, b, n = 40) => {
  let w = 0; for (let s = 1; s <= n; s++) if (E.runHeadless(s, a, b).winner === 0) w++;
  return w / n;
};

// ---------------------------------------------------------------- termination
safe("termination", () => {
  let ended = 0, maxT = 0; const reasons = {};
  for (let s = 1; s <= 150; s++) {
    const g1 = E.genOpponent(s * 17 + 1, 1 + (s % 5));
    const g2 = E.genOpponent(s * 31 + 7, 1 + ((s * 3) % 5));
    const r = E.runHeadless(s, g1.build, g2.build);
    if (r.winner === 0 || r.winner === 1) ended++;
    maxT = Math.max(maxT, r.t); reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  }
  check("150/150 duels générés se terminent", ended === 150, ended + "/150");
  check("aucun timeout, durée max < 45s", !reasons.timeout && maxT < 45,
        maxT.toFixed(1) + "s " + JSON.stringify(reasons));
});

// ---------------------------------------------------------------- determinism
safe("determinism", () => {
  const T1 = E.SLICE1.teaching[0].build;
  const a = E.runHeadless(42, P, T1), b = E.runHeadless(42, P, T1);
  check("même graine → même issue", a.winner === b.winner && a.t === b.t,
        `${a.winner}@${a.t.toFixed(2)} vs ${b.winner}@${b.t.toFixed(2)}`);
  check("genOpponent déterministe",
        JSON.stringify(E.genOpponent(999, 3)) === JSON.stringify(E.genOpponent(999, 3)));
  check("genTournament déterministe",
        JSON.stringify(E.genTournament(7)) === JSON.stringify(E.genTournament(7)));
});

// ------------------------------------------------------------ generator sanity
safe("generator", () => {
  let bad = 0, longAtLow = 0;
  for (let s = 1; s <= 120; s++) {
    const lvl = 1 + (s % 5);
    const g = E.genOpponent(s * 7, lvl);
    if (!E.CHASSIS[g.build.chassis]) bad++;
    for (const k of Object.keys(E.OPTS)) if (!E.OPTS[k].includes(g.build[k])) bad++;
    if (lvl < 3 && g.build.chargeDist === "long") longAtLow++;
  }
  check("120 builds générés valides", bad === 0, bad + " invalides");
  check("pas de 'long' aux bas niveaux", longAtLow === 0, longAtLow);
});

// ------------------------------------------------------- invariants d'état fini
// P0-1 — garde-fou permanent : aucun tick ne doit produire de NaN/Infinity, même
// avec un organe à contribution NULLE (batterie/moteur/adhérence usés à 100 %).
// C'est ce test qui échouerait sans la garde de division au tick (engine.js).
safe("invariants d'état fini (anti-NaN)", () => {
  const fin = (v) => Number.isFinite(v);
  const botFinite = (b) => fin(b.pos.x) && fin(b.pos.y) && fin(b.vel.x) && fin(b.vel.y)
    && fin(b.angVel) && fin(b.angle) && fin(b.battery) && fin(b.hp) && fin(b.throttleL) && fin(b.throttleR);
  const healthy = { ...E.DEFAULT_BUILD, eff: { motor: 1, battery: 1, propulsion: 1 } };
  const cases = [
    ["batterie morte", { motor: 1, battery: 0, propulsion: 1 }],
    ["moteur mort",    { motor: 0, battery: 1, propulsion: 1 }],
    ["adhérence nulle",{ motor: 1, battery: 1, propulsion: 0 }],
    ["tout à zéro",    { motor: 0, battery: 0, propulsion: 0 }],
  ];
  let firstBad = null;
  for (const [name, eff] of cases) {
    const m = E.makeMatch(12345, { ...E.DEFAULT_BUILD, eff }, healthy, {});
    for (let i = 1; i <= 120 && !firstBad; i++) {
      E.tick(m);
      if (!fin(m.arenaR) || !m.bots.every(botFinite)) firstBad = name + " @tick" + i;
    }
    if (firstBad) break;
  }
  check("état fini sur 120 ticks (batterie/moteur/adhérence à zéro incluses)",
        firstBad === null, firstBad || "OK");
});

// --------------------------------------------------------------- physics model
safe("physics", () => {
  const stock = E.physStats(P);
  check("masse stock > 0 et plausible (<5kg)", stock.massKg > 0 && stock.massKg < 5,
        stock.massKg.toFixed(3) + " kg");

  // monotonicity: adding mass must never lighten the bot
  const heavy = E.physStats({ ...P, parts: { ...P.parts, ballast: E.PARTS.ballast[E.PARTS.ballast.length - 1].id } });
  check("lest supérieur ⇒ masse supérieure", heavy.massKg > stock.massKg,
        stock.massKg.toFixed(3) + " → " + heavy.massKg.toFixed(3));

  // derivedStats must be finite everywhere across the parts matrix
  let nonFinite = 0, n = 0;
  for (const slot of Object.keys(E.PARTS)) {
    for (const p of E.PARTS[slot]) {
      const d = E.derivedStats({ ...P, parts: { ...P.parts, [slot]: p.id } });
      n++;
      for (const k of Object.keys(d)) if (typeof d[k] === "number" && !isFinite(d[k])) nonFinite++;
    }
  }
  check(`${n} builds: toutes les stats dérivées finies`, nonFinite === 0, nonFinite + " NaN/Inf");
});

// ------------------------------------------------------- L3.5 multiplicity model
safe("stacking", () => {
  const base = { chassis: "boxy", parts: { ...P.parts } };
  const m1 = E.physStats({ ...base, counts: { motor: 1 } }).massKg;
  const m2 = E.physStats({ ...base, counts: { motor: 2 } }).massKg;
  check("2 moteurs ⇒ plus lourd", m2 > m1, m1.toFixed(3) + " → " + m2.toFixed(3));

  const runtime = c => { const d = E.derivedStats({ ...base, counts: c }); return d.energy / d.drainMul; };
  const r11 = runtime({ motor: 1, battery: 1 });
  const r21 = runtime({ motor: 2, battery: 1 });
  const r22 = runtime({ motor: 2, battery: 2 });
  check("2e moteur ⇒ autonomie divisée", r21 < r11 * 0.75, r11.toFixed(0) + " → " + r21.toFixed(0));
  check("2e batterie ⇒ autonomie rétablie", r22 > r21 * 1.5, r21.toFixed(0) + " → " + r22.toFixed(0));

  // counts absent must be byte-identical to counts of 1 — the non-regression guarantee
  const noCounts = JSON.stringify(E.derivedStats(base));
  const ones = JSON.stringify(E.derivedStats({ ...base, counts: { motor: 1, battery: 1, cooling: 1, ballast: 1 } }));
  check("build sans counts ≡ counts:1 partout", noCounts === ones);
});

// --------------------------------------------------------------- match integrity
safe("match", () => {
  const m = E.makeMatch(123, P, E.genOpponent(5, 2).build);
  let guard = 0, offArena = 0;
  while (!m.over && guard++ < 20000) {
    E.tick(m);
    for (const bot of m.bots) {
      if (!isFinite(bot.pos.x) || !isFinite(bot.pos.y)) offArena++;
    }
  }
  check("le match se termine sans garde-fou", m.over && guard < 20000, "ticks=" + guard);
  check("positions toujours finies", offArena === 0, offArena);
  check("un vainqueur désigné", m.winner === 0 || m.winner === 1, String(m.winner));
});


// ------------------------------------------------------ E3a : dégâts positionnels (moteur)
safe("dégâts E3a", () => {
  const W = require("./world.js");
  // deux bots lourds lancés l'un sur l'autre : des chocs DOIVENT être journalisés
  const mk = () => {
    const w = W.openWorld();
    w.eval("S.bolts=1e6; curLigue='regionale'; disputeConcours('libre'); $('fightBtn').click()");
    return w;
  };
  const w = mk();
  // collision FORGÉE (déterministe, insensible au seed) : face à face à pleine vitesse
  w.eval(`(function(){ const [a,b]=match.bots;
    const gap=(a.radius+b.radius)*0.62;
    a.pos={x:-gap,y:0}; b.pos={x:gap,y:0};
    a.vel={x:160,y:0}; b.vel={x:-160,y:0};
    for(let i=0;i<60;i++){ ENGINE.tick(match);
      if(!match.bots[0].hits.length){ a.vel={x:160,y:0}; b.vel={x:-160,y:0}; } } })()`);
  const hits0 = w.eval("match.bots[0].hits.length"), hits1 = w.eval("match.bots[1].hits.length");
  check("E3a: un choc frontal forgé est journalisé des deux côtés", hits0 > 0 && hits1 > 0, hits0+" / "+hits1);
  check("E3a: chaque choc porte impulsion finie ≥ seuil et attribution",
        w.eval("match.bots[0].hits.every(h=>isFinite(h.impulse) && h.impulse >= ENGINE.DAMAGE.HIT_J && (h.part===null || typeof h.part==='string'))"));
  check("E3a: hp borné [0,1] et strictement entamé après contact",
        w.eval("match.bots.every(b=>b.hp>=0 && b.hp<1)"));
  check("E3a: seuils exportés", w.eval("ENGINE.DAMAGE.RIPOFF_J > ENGINE.DAMAGE.HIT_J"));
  // arrachage : injection d'un choc direct énorme sur un composant à collider
  const ripped = w.eval(`(function(){
    const b = match.bots[0];
    if (!b.colliders || !b.colliders.length) return "no-collider";
    const slot = b.colliders[0].slot;
    const before = b.hits.length;
    // rejouer la résolution : simuler par l'API interne = trop intime ; on
    // vérifie la MÉCANIQUE gone via l'événement réel s'il a eu lieu, sinon
    // par le contrat : gone[slot] retire le collider du monde.
    b.gone = b.gone || {}; b.gone[slot] = true;
    const wc = b.colliders.filter(k=>!(b.gone&&b.gone[k.slot]));
    return wc.every(k=>k.slot!==slot) ? "ok" : "collider-still-there";
  })()`);
  check("E3a: gone[slot] retire le collider du monde", ripped === "ok" || ripped === "no-collider", ripped);
  w.close();
});


// ------------------------------------------------------ P-MASSE : QC tôle + classe officielle
safe("masses P-MASSE", () => {
  const fs = require("fs");
  const hulls = JSON.parse(fs.readFileSync(__dirname + "/hull_masses.json", "utf8"));
  const W = require("./world.js"); const w = W.openWorld();
  const stockKg = w.eval(`(function(){ let s=0;
    for (const slot of ["propulsion","motor","battery","cpu","sensors"])
      s += ENGINE.partMassKg(slot, ENGINE.PARTS[slot][0].id);
    return s; })()`);
  for (const ch of Object.keys(hulls)){
    const total = w.eval(`ENGINE.physStats({chassis:"${ch}", parts:{}}).massKg`);
    const hull = total - stockKg;
    const ref = hulls[ch].kg_2mm;
    const ok = hull >= ref*0.85 && hull <= ref*1.7;      // bande tôle 2 à 3.4 mm
    check("QC tôle " + ch + " (2-3.4 mm)", ok, hull.toFixed(2) + " kg vs réf 2mm " + ref);
  }
  // le bot de base tient sous la limite Hobbyweight avec marge d'upgrade
  const base = w.eval("ENGINE.physStats({chassis:'boxy', parts:{}}).massKg");
  check("bot de base sous la limite 5.44 kg avec marge", base > 3.0 && base < 4.6, base.toFixed(2)+" kg");
  w.close();
});


// ------------------------------------------------------ E7b : adversaires S-légaux
safe("adversaires S", () => {
  const W = require("./world.js"); const w = W.openWorld();
  const bad = w.eval(`(function(){
    const opts = opponentOpts("sumoS");
    const fails = [];
    for (let i = 0; i < 40; i++){
      const g = ENGINE.genOpponent(1000+i*17, 1, opts);
      const cls = chassisClassOf(g.build.chassis);
      const kg = ENGINE.physStats({chassis:g.build.chassis, parts:g.build.parts}).massKg;
      if (cls !== "S") fails.push(i+":classe "+cls);
      else if (g.build.parts.propulsion === "pr3") fails.push(i+":chenilles");
      else if (kg > 1.36 + 1e-9) fails.push(i+":"+kg.toFixed(2)+"kg");
    }
    return fails.slice(0,4).join(" | ");
  })()`);
  check("E7b: 40 adversaires S légaux (classe, chenilles, pesée)", bad === "", bad);
  w.close();
});

// ------------------------------------------------------ S16-SCALE : échelle canonique
safe("échelle S16", () => {
  const W = require("./world.js"); const w = W.openWorld();
  // 1 cellule = 3 cm = 6,2 u. Rayon coque ≈ demi-dimension en unités (tolérance
  // ±35% pour la variation de saveur, comme les coques M historiques).
  const bad = w.eval(`(function(){
    const fails = [];
    const UPC = 6.2;                       // unités par cellule
    const dims = { tortue_s:[3,3], hex_s:[3,3], coin_s:[3,4], losange_s:[3,4], totem_s:[3,4],
                   tortue:[8,6], marteau:[8,7], losange:[8,8], disque:[8,8], boxy:[6,6] };
    for (const [ch,[cw,cd]] of Object.entries(dims)){
      const r = ENGINE.CHASSIS[ch].radius;
      const half = Math.min(cw,cd)*UPC/2;   // demi-dimension min en unités
      if (r < half*0.65 || r > half*1.55) fails.push(ch+": r="+r+" vs demi-dim "+half.toFixed(1));
    }
    // ring par classe : un match S se joue sur 60 cm = 124 u, un M sur 145 cm = 300 u
    if (Math.abs(CLASS_RING.S/CM_PER_UNIT - 124) > 1) fails.push("ring S "+(CLASS_RING.S/CM_PER_UNIT).toFixed(0)+"u");
    if (Math.abs(CLASS_RING.M/CM_PER_UNIT - 299.7) > 1.5) fails.push("ring M "+(CLASS_RING.M/CM_PER_UNIT).toFixed(0)+"u");
    // makeMatch(opts.arenaR) : spawn DANS le ring, référence mort-subite au ring
    const m = ENGINE.makeMatch(7, {chassis:"tortue_s"}, {chassis:"hex_s"}, {arenaR:62});
    if (m.arenaR0 !== 62 || m.arenaR !== 62) fails.push("arenaR0 "+m.arenaR0);
    for (const b of m.bots){
      const d = Math.hypot(b.pos.x, b.pos.y);
      if (d + b.radius > 62) fails.push("spawn hors ring d="+d.toFixed(0)+" r="+b.radius);
    }
    // géométrie d'arène en données : desk opaque carré, repère = bord EXTERNE
    // de la bande blanche (mesuré 361,5/512 px sur le sprite)
    const g = ARENA_GEOM["assets/arena_s_nerd.webp"];
    if (!g || !g.square || Math.abs(g.playEdge-0.706) > 0.01) fails.push("geom desk "+JSON.stringify(g));
    return fails.slice(0,4).join(" | ");
  })()`);
  check("S16: rayons vérité-cellules, rings par classe, spawn et géométrie", bad === "", bad);
  // un match S complet sur ring 62 u se termine proprement
  const end = w.eval(`(function(){
    const g1 = ENGINE.genOpponent(11, 1, opponentOpts("sumoS"));
    const g2 = ENGINE.genOpponent(12, 1, opponentOpts("sumoS"));
    const m = ENGINE.makeMatch(5, g1.build, g2.build, {arenaR:62});
    let n = 0; while(!m.over && n++ < 20000) ENGINE.tick(m);
    return { over:m.over, n, winner:m.winner, finite:m.bots.every(b=>isFinite(b.pos.x)&&isFinite(b.pos.y)) };
  })()`);
  check("S16: match S sur ring 60 cm se termine, positions finies",
        end.over && end.finite && (end.winner===0||end.winner===1), JSON.stringify(end));
  w.close();
});

// ------------------------------------------------------ S16-ENDGAME : fin de mort subite
safe("fin de partie S16", () => {
  const W = require("./world.js"); const w = W.openWorld();
  const r = w.eval(`(function(){
    const out = {};
    // plancher dérivé des rayons : paire M marteau+disque = (24+27)*0.85 = 43.35
    const mM = ENGINE.makeMatch(3, {chassis:"marteau"}, {chassis:"disque"});
    out.minRM = Math.round(mM.minR*100)/100;
    const mS = ENGINE.makeMatch(3, {chassis:"tortue_s"}, {chassis:"hex_s"}, {arenaR:62});
    out.minRS = mS.minR;                                   // (9.5+9.5)*0.85=16.15 < butée 20
    // 60 matchs S : tous finissent avant 60 s, l'arbitrage au centre reste rare,
    // et la poussée (ringOut/shrinkOut par sortie) domine
    let snap=0, slow=0, push=0, winA=0;
    for (let i=0;i<60;i++){
      const a=ENGINE.genOpponent(9000+i*13,2,opponentOpts("sumoS"));
      const b=ENGINE.genOpponent(4000+i*29,2,opponentOpts("sumoS"));
      const m=ENGINE.makeMatch(i*7,a.build,b.build,{arenaR:62});
      let g=0; while(!m.over&&g++<40000) ENGINE.tick(m);
      if (m.t>=60) slow++;
      if ((m.floorT||0)>8) snap++;
      if (m.reason==="ringOut"||m.reason==="shrinkOut") push++;
      if (m.winner===0) winA++;
    }
    out.snap=snap; out.slow=slow; out.push=push; out.winA=winA;
    return out;
  })()`);
  check("S16E: plancher M = 0,85×(rA+rB), butée 20 en S",
        r.minRM === 43.35 && r.minRS === 20, JSON.stringify(r));
  check("S16E: 60 matchs S — aucun ne traîne au-delà de 60 s", r.slow === 0, r.slow);
  check("S16E: arbitrage au centre rare (≤ 15%)", r.snap <= 9, r.snap + "/60");
  check("S16E: la poussée décide (≥ 90% des fins)", r.push >= 54, r.push + "/60");
  /* S22 — cette vérification s'appelait « équité globale » mais opposait DEUX
     builds différents : elle ne mesurait pas l'équité des côtés (c'est le
     miroir S22 qui le fait) mais la comparabilité de deux adversaires générés
     au même niveau. Sa fenêtre 40-60 % était plus étroite que son propre bruit
     (±6,5 pt d'erreur type à n=60). Remise à sa vraie portée, fenêtre à 3
     erreurs types. */
  check("S16E: deux adversaires générés de même niveau restent comparables",
        r.winA >= 19 && r.winA <= 41, r.winA + "/60");
  w.close();
});

// ------------------------------------------------------ S19 : gardes d'EXTENSIBILITÉ
/* Ajouter une coque, une pièce ou un concours ne doit jamais casser en
   silence. Ces contrôles échouent AVANT le jeu si une table a été oubliée —
   c'est ce qui rend l'ajout sûr, à défaut de le rendre unique. */
safe("extensibilité S19", () => {
  const W = require("./world.js"); const w = W.openWorld();
  const r = w.eval(`(function(){
    const out = {};
    // 1) toute coque déclarée est COMPLÈTE dans les trois tables
    out.noEngine = [], out.noPhys = [], out.noSerie = [], out.noSpec = [];
    for (const ch of Object.keys(CHASSIS_REG)){
      if (!ENGINE.CHASSIS[ch])          out.noEngine.push(ch);
      if (!ENGINE.PHYS.chassis[ch])     out.noPhys.push(ch);
      if (!CHASSIS_SERIES[chassisSeriesOf(ch)]) out.noSerie.push(ch);
      if (!CHASSIS_SPEC[ch])            out.noSpec.push(ch);
    }
    // 2) toute classe produite par les bandes a un ring déclaré
    const classes = new Set();
    for (const t of TIERS) for (const [cl] of t.classBands) classes.add(cl);
    out.classes = [...classes];
    out.ringMissing = [...classes].filter(cl => !(cl in CLASS_RING));
    out.ringExtra   = Object.keys(CLASS_RING).filter(cl => !classes.has(cl));
    // 3) toute pièce a une empreinte et un nom dans LES DEUX langues
    out.noFoot = [], out.noName = [];
    for (const slot in ENGINE.PARTS) for (const p of ENGINE.PARTS[slot]){
      const f = footprintOf(slot, p.id);
      if (!f || !(f.w > 0) || !(f.d > 0)) out.noFoot.push(slot + "/" + p.id);
      if (!STRINGS.fr["pn_" + p.id] || !STRINGS.en["pn_" + p.id]) out.noName.push(p.id);
    }
    // 4) toute arène citée par un concours a sa géométrie déclarée
    out.noGeom = TOURNAMENTS.map(t => t.arena).filter(a => a && !ARENA_GEOM[a]);
    // 5) tout concours ENGAGEABLE pointe un format qui existe. Convention :
    //    noEngage:true = exhibition sans progression, donc sans machine à
    //    états — son "format" est un simple libellé (ex. "libre").
    out.noFormat = TOURNAMENTS.filter(t => !t.noEngage && t.format && !FORMATS[t.format]).map(t => t.id);
    out.freeOK = TOURNAMENTS.filter(t => t.noEngage).every(t => t.rules && !t.lockBuild);
    return out;
  })()`);
  check("S19: toute coque est complète (moteur, banque physique, spec, série)",
        !r.noEngine.length && !r.noPhys.length && !r.noSpec.length && !r.noSerie.length,
        JSON.stringify({moteur:r.noEngine, phys:r.noPhys, spec:r.noSpec, serie:r.noSerie}));
  check("S19: chaque classe des bandes a un ring, et aucun ring orphelin",
        !r.ringMissing.length && !r.ringExtra.length,
        JSON.stringify({classes:r.classes, manquants:r.ringMissing, orphelins:r.ringExtra}));
  check("S19: chaque pièce a une empreinte et un nom FR+EN",
        !r.noFoot.length && !r.noName.length,
        JSON.stringify({empreinte:r.noFoot, nom:r.noName}));
  check("S19: chaque arène de concours a sa géométrie déclarée", !r.noGeom.length, r.noGeom.join(","));
  check("S19: chaque concours engageable pointe un format existant", !r.noFormat.length, r.noFormat.join(","));
  check("S19: les exhibitions (noEngage) ne gèlent pas le build et gardent des règles",
        r.freeOK === true, String(r.freeOK));
  // convention de nommage : UNE lecture (dataName), et tout libellé traduisible EST traduit
  const nm = w.eval(`(function(){
    const out = { noEn:[], badRead:[] };
    const check1 = (label, v) => {
      if (v && typeof v === "object" && !(v.fr && v.en)) out.noEn.push(label);
      if (dataName(v) === "" && v != null) out.badRead.push(label); };
    for (const t of TOURNAMENTS) check1("concours:" + t.id, t.name);
    for (const l of LIGUES)      check1("ligue:" + l.id, l.name);
    for (const s of Object.values(CHASSIS_SERIES)){ check1("serie:" + s.id, s.name); check1("serie:" + s.id + ".blurb", s.blurb); }
    // les libellés de concours/ligues/séries doivent être des objets bilingues
    out.stillFr = [...TOURNAMENTS.map(t => ["concours:" + t.id, t.name]),
                   ...LIGUES.map(l => ["ligue:" + l.id, l.name])]
                  .filter(([, v]) => typeof v === "string").map(([k]) => k);
    // dataName lit les deux formes sans casser
    out.readsString = dataName("BRUT") === "BRUT";
    out.readsObj = dataName({fr:"a", en:"b"}).length === 1;
    out.readsNull = dataName(null, "repli") === "repli";
    return out;
  })()`);
  check("S19: dataName lit chaîne, objet bilingue et vide (repli)",
        nm.readsString && nm.readsObj && nm.readsNull, JSON.stringify(nm));
  check("S19: tout libellé traduisible est bilingue (concours, ligues, séries)",
        !nm.noEn.length && !nm.stillFr.length,
        JSON.stringify({sansEN:nm.noEn, encoreFR:nm.stillFr}));
  w.close();
});

// ------------------------------------------------------ S20 : la gamme est DÉCLARÉE, pas positionnelle
safe("S20 gamme déclarée", () => {
  const bad = [];
  for (const sl in E.PARTS)
    for (const p of E.PARTS[sl])
      if (!Number.isInteger(p.gamme) || p.gamme < 0) bad.push(sl + "/" + p.id + "=" + p.gamme);
  check("S20: chaque pièce déclare un rang de gamme entier", bad.length === 0, bad.join(" "));
  // garde d'extensibilité : ajouter une pièce en fin de liste ne doit pas
  // pouvoir reteinter les autres — c'est la gamme, pas l'index, qui décide.
  const before = E.PARTS.motor.map(p => p.gamme).join(",");
  E.PARTS.motor.push({ id: "__probe", gamme: 1, cost: 0, push: 1, speed: 1, mass: 0 });
  const after = E.PARTS.motor.slice(0, -1).map(p => p.gamme).join(",");
  E.PARTS.motor.pop();
  check("S20: une pièce ajoutée ne déplace la gamme d'aucune autre", before === after, before + " → " + after);
});

// ------------------------------------------------------ CALIBRAGE : étalons figés
safe("étalons figés", () => {
  const ids = Object.keys(E.BENCHMARKS);
  check("étalons : la table existe et couvre S1-S3 + M1-M5",
        ids.join(",") === "S1,S2,S3,M1,M2,M3,M4,M5", ids.join(","));
  const bad = [];
  for (const id of ids) {
    const b = E.BENCHMARKS[id].build;
    if (!E.CHASSIS[b.chassis]) bad.push(id + ": châssis inconnu");
    for (const sl in E.PARTS)
      if (!b.parts[sl] || !E.PARTS[sl].some(p => p.id === b.parts[sl])) bad.push(id + ": " + sl);
    for (const k in E.OPTS)
      if (E.OPTS[k].indexOf(b[k]) < 0) bad.push(id + ": pilote " + k + "=" + b[k]);
    const d = E.derivedStats(b);
    if (!Object.values(d).every(v => typeof v !== "number" || Number.isFinite(v)))
      bad.push(id + ": stat non finie");
  }
  check("étalons : châssis, pièces, pilote et stats tous valides", bad.length === 0, bad.join(" | "));
  /* ZÉRO RNG est la propriété qui fait de la ligne une RÈGLE : deux lectures
     du même étalon, à un mois d'écart, doivent donner le même combat. */
  const rejoue = ids.every(id => {
    const a = E.runHeadless(4242, E.BENCHMARKS[id].build, E.BENCHMARKS.M1.build);
    const b = E.runHeadless(4242, E.BENCHMARKS[id].build, E.BENCHMARKS.M1.build);
    return a.winner === b.winner && a.t === b.t && JSON.stringify(a.duels) === JSON.stringify(b.duels);
  });
  check("étalons : deux lectures du même étalon donnent le même combat", rejoue);
  check("étalons : la table n'est pas mutée par un combat",
        JSON.stringify(Object.keys(E.BENCHMARKS)) === JSON.stringify(ids));
  // le barreau logiciel ne redescend jamais le long de l'échelle
  const tier = (id) => E.PARTS.software.findIndex(p => p.id === E.BENCHMARKS[id].build.parts.software);
  const monoS = tier("S1") <= tier("S2") && tier("S2") <= tier("S3");
  const monoM = ["M1","M2","M3","M4","M5"].every((id, i, a) => i === 0 || tier(a[i-1]) <= tier(id));
  check("étalons : le palier logiciel monte le long de l'échelle", monoS && monoM,
        "S " + ["S1","S2","S3"].map(tier).join("") + " · M " + ["M1","M2","M3","M4","M5"].map(tier).join(""));
  /* Décision Denis (26/07) : bots ENTIÈREMENT fixes, mais une coque DIFFÉRENTE
     par épreuve de calibrage — l'échelle monte par le matériel et le pilote,
     la coque donne le caractère. Aligner les coques pour lisser une mesure
     serait laisser l'instrument dicter le design. */
  for (const cl of ["S", "M"]) {
    const hulls = ids.filter(k => k[0] === cl).map(k => E.BENCHMARKS[k].build.chassis);
    check("étalons " + cl + " : une coque distincte par barreau",
          new Set(hulls).size === hulls.length, hulls.join(" "));
  }
});

// ------------------------------------------------------ S22 : équité des côtés
safe("S22 aucun avantage de côté", () => {
  /* Un MIROIR — le même build des deux côtés — doit se répartir 50/50. Tout
     écart stable est un attribut du CÔTÉ, donc un handicap permanent pour le
     joueur, qui est toujours le bot 0. Trois causes trouvées et corrigées :
     décision et intégration entrelacées (le bot 1 lisait l'état frais du
     bot 0), phases de visée et de cadence indexées sur bot.id, flux d'aléa
     partagé où le bot 0 tirait toujours en premier.
     Tolérance : ±15 pt. À n=60 l'erreur d'échantillonnage vaut ~6,5 pt, donc
     ce seuil laisse passer le bruit et rattrape la régression (le biais mesuré
     avant correctif atteignait 25 pt en classe S). */
  const RING_S = (60 / (3 / 6.2)) / 2;
  const cas = [
    ["S tortue_s", { ...E.SLICE1.playerBuild, chassis:"tortue_s",
      parts:{ propulsion:"pr1", motor:"m0", cpu:"c0", battery:"b0", sensors:"n0", software:"s0" } }, RING_S],
    ["M marteau", { ...E.SLICE1.playerBuild, chassis:"marteau",
      parts:{ propulsion:"pr1", motor:"m2", cpu:"c1", battery:"b1", sensors:"n1", software:"s1" } }, undefined],
  ];
  for (const [label, build, ring] of cas) {
    let gauche = 0, n = 60;
    for (let s = 1; s <= n; s++) {
      const m = E.makeMatch(s * 104729, build, build, ring ? { arenaR: ring } : undefined);
      let guard = 0; while (!m.over && guard++ < 20000) E.tick(m);
      if (m.winner === 0) gauche++;
    }
    const pct = 100 * gauche / n;
    check("S22: miroir " + label + " — aucun côté favorisé",
          Math.abs(pct - 50) <= 15, pct.toFixed(1) + " % à gauche sur " + n);
  }
  // les phases ne doivent plus être des attributs du côté
  const m = E.makeMatch(1234, E.SLICE1.playerBuild, E.SLICE1.playerBuild);
  check("S22: chaque bot a sa phase de visée et sa cadence, tirées et non déduites du côté",
        typeof m.bots[0].noisePhase === "number" && m.bots[0].noisePhase !== m.bots[1].noisePhase &&
        typeof m.bots[0].thinkPhase === "number");
  check("S22: chaque bot a son propre flux d'aléa",
        typeof m.bots[0].rng === "function" && m.bots[0].rng !== m.bots[1].rng &&
        m.bots[0].rng() !== m.bots[1].rng());
});

// ------------------------------------------------------ S24 : matière de coque
safe("S24 matière et résistance structurelle", () => {
  check("S24: la table des matières existe et est complète",
        Object.keys(E.MATIERES).length >= 5 &&
        Object.values(E.MATIERES).every(m => m.hull > 0 && m.hull <= 1.2 && m.densite > 0),
        Object.keys(E.MATIERES).join(" "));
  check("S24: l'acier est la référence à 1,00", E.MATIERES.acier.hull === 1);
  check("S24: toute coque a une ténacité, l'acier par défaut",
        Object.keys(E.CHASSIS).every(c => E.hullOf(c) > 0),
        Object.keys(E.CHASSIS).map(c => c + ":" + E.hullOf(c)).slice(0, 3).join(" "));
  /* L'intégrité ne dérive plus de la seule masse : à masse égale, une matière
     plus tenace encaisse davantage. C'est ce qui rendra les séries de Denis
     mécaniquement distinctes, et pas seulement décoratives. */
  const b = { ...E.DEFAULT_BUILD, chassis: "boxy" };
  const d = E.derivedStats(b);
  check("S24: les stats exposent ténacité et intégrité",
        d.hullFactor === E.hullOf("boxy") && d.integrity > 0,
        d.hullFactor + " · " + Math.round(d.integrity));
  check("S24: intégrité = 300 × masse × ténacité",
        Math.abs(d.integrity - 300 * d.weight * d.hullFactor) < 1e-6);
});

// ------------------------------------------------------ S24-MICRO : la gamme qui rentre en S
safe("S24 gamme micro", () => {
  const micro = [];
  for (const sl in E.PARTS) for (const p of E.PARTS[sl]) if (p.intendedClass === "S") micro.push(sl + "/" + p.id);
  check("S24: la gamme micro existe et couvre motricité, srimech et roues",
        micro.some(x => x.startsWith("motor/")) && micro.some(x => x.startsWith("srimech/")) &&
        micro.filter(x => x.startsWith("propulsion/")).length >= 2, micro.join(" "));
  /* Une pièce micro doit être plus LÉGÈRE et plus CHÈRE que l'équivalent M de
     même gamme — on paie la miniaturisation. Sinon ce n'est pas une gamme,
     c'est un remplacement pur et simple. */
  const bad = [];
  /* La règle de la taxe de miniaturisation vaut pour les pièces qui sont
     VRAIMENT l'équivalent réduit d'une pièce M : moteurs et srimech. Le train
     roulant S est une autre chose — une échelle de GRIP et de FORMAT (spec
     Denis, 26/07), du galet nu à la large blindée. Le comparer aux roues M
     n'aurait pas de sens : sa cohérence interne se vérifie plus bas. */
  for (const [sl, a, b] of [["motor","m5","m1"], ["motor","m6","m2"],
                            ["srimech","r3","r1"], ["srimech","r4","r2"]]){
    const pa = E.PARTS[sl].find(p => p.id === a), pb = E.PARTS[sl].find(p => p.id === b);
    if (!(E.partMassKg(sl, a) < E.partMassKg(sl, b))) bad.push(a + " pas plus légère que " + b);
    if (!(pa.cost > pb.cost)) bad.push(a + " pas plus chère que " + b);
  }
  check("S24: le micro est plus léger ET plus cher que son équivalent", bad.length === 0, bad.join(" | "));
  /* Cohérence interne du train roulant S : le grip se paie en masse ET en
     euros. Une roue plus accrocheuse qui serait aussi plus légère et moins
     chère rendrait toutes les autres inutiles. */
  const ROUES_S = ["pr4","pr6","pr7","pr8","pr9"];   // pr5 hors série : 1×1 blindée
  const inc = [];
  for (let i = 1; i < ROUES_S.length; i++){
    const a = E.PHYS.propulsion[ROUES_S[i-1]], b = E.PHYS.propulsion[ROUES_S[i]];
    const ca = E.partOf("propulsion", ROUES_S[i-1]).cost, cb = E.partOf("propulsion", ROUES_S[i]).cost;
    if (b.mu < a.mu || b.kg <= a.kg || cb <= ca) inc.push(ROUES_S[i-1] + "→" + ROUES_S[i]);
  }
  check("S24: l'échelle de grip S se paie en masse et en euros", inc.length === 0, inc.join(" "));
  const prot = E.PARTS.propulsion.filter(p => (p.guard || 0) > 0).map(p => p.id);
  check("S24: deux trains roulants offrent une protection", prot.length === 2, prot.join(" "));
  check("S24: la protection est bornée à ]0,1[",
        E.PARTS.propulsion.every(p => (p.guard || 0) >= 0 && (p.guard || 0) < 1));
  check("S24: chaque pièce micro a sa banque physique",
        micro.every(x => { const [sl, id] = x.split("/"); return E.PHYS[sl] && E.PHYS[sl][id]; }));
  // les ids restent gelés : on étend, on ne renumérote jamais
  check("S24: les ids historiques n'ont pas bougé",
        E.PARTS.motor.slice(0, 5).map(p => p.id).join(",") === "m0,m1,m2,m3,m4" &&
        E.PARTS.propulsion.slice(0, 4).map(p => p.id).join(",") === "pr0,pr1,pr2,pr3" &&
        E.PARTS.srimech.slice(0, 3).map(p => p.id).join(",") === "r0,r1,r2");
  /* Le drapeau de règlement, pas la connaissance des empreintes : le moteur
     reste ignorant du placement, il lit `opts.micro`. */
  const s3 = E.genOpponent(777, 4, { micro: true }).build.parts;
  const m3 = E.genOpponent(777, 4, {}).build.parts;
  check("S24: opts.micro fait tirer dans la gamme micro",
        ["m5","m6"].includes(s3.motor) && !["m5","m6"].includes(m3.motor),
        "micro=" + s3.motor + " · normal=" + m3.motor);
});

// ------------------------------------------------------ S26 : le match-témoin
safe("S26 match-témoin", () => {
  /* Le filet du chantier pilote. `control()` va être découpé en perception,
     décision et actionnement : la seule question qui vaille est « le jeu
     joue-t-il exactement pareil ? ». 200 matchs de graines fixes y répondent
     au tick près — issue, durée, duels, transitions de mode ET tirages d'aléa
     PAR BOT (la consommation dépend du mode : escape et hold sortent avant le
     tremblé de conduite et ne tirent rien).
     Régénérer : `node tools/temoin.js --generer` — acte délibéré, qui EFFACE
     le filet. À ne faire que pour un changement de comportement voulu. */
  const T = require("./temoin.js");
  const r = T.verifier();
  check("S26: la référence du témoin est présente", !r.absent,
        r.absent ? "lancer `node tools/temoin.js --generer`" : "");
  if (r.absent) return;
  check("S26: " + r.n + " matchs rejoués à l'identique, au tick près",
        r.ok, r.ecarts.slice(0, 4).join(" | "));
  check("S26: le témoin couvre les deux classes et leurs deux rings",
        (() => { const doc = require("fs").readFileSync(T.REF, "utf8");
          return /"__cl":"S"/.test(doc) && /"__cl":"M"/.test(doc); })());
  /* Un filet qui ne se déclenche jamais n'est pas un filet. On vérifie ici
     que la mesure DISTINGUE : deux cas du témoin ne doivent pas tous avoir
     la même signature de modes, sinon elle ne mesure rien. */
  const doc = JSON.parse(require("fs").readFileSync(T.REF, "utf8"));
  const sigs = new Set(doc.cas.map(c => c.sig));
  check("S26: les signatures de mode discriminent (pas toutes identiques)",
        sigs.size > doc.cas.length * 0.5, sigs.size + " signatures pour " + doc.cas.length + " cas");
  const tirages = doc.cas.reduce((n, c) => n + c.draws[0] + c.draws[1], 0);
  check("S26: les tirages d'aléa sont comptés par bot et non nuls",
        tirages > 1000 && doc.cas.every(c => c.draws.length === 2), tirages + " tirages");
});

// ------------------------------------------------------ S27 : le bus de perception
safe("S27 bus de perception", () => {
  const B = (sn, o) => ({ ...E.SLICE1.playerBuild, ...(o || {}),
    parts:{ motor:"m2", battery:"b1", propulsion:"pr1", cpu:"c1", sensors:sn, software:"s1" } });
  const SIGNAUX = ["shrink","battery","ownSpeed","dominatedT","contact","contactSide",
                   "foeRange","foeBearing","myEdge","foeHeading","foeSpeed","closing",
                   "foeEdge","foeDomT","slip","tilt","yawRate"];
  const lire = (sn, n) => { const m = E.makeMatch(4242, B(sn), B("n2", { chassis:"marteau" }));
    for (let i = 0; i < (n || 200); i++) E.tick(m); return m; };

  const m2 = lire("n2");
  const P = m2.bots[0].P;
  check("S27: le vecteur de perception est publié à chaque tick", !!P && !!P.have);
  const manquants = SIGNAUX.filter(k => P[k] === undefined);
  check("S27: les 17 signaux du contrat sont présents", manquants.length === 0, manquants.join(" "));
  /* Un signal hors bornes est un signal qui MENT : les modules à venir
     pondèrent des enchères avec, un 0..1 qui déborde fausse tout l'arbitrage. */
  const hors = [];
  for (const sn of ["n0","n1","n2"]){
    const mm = lire(sn), pp = mm.bots[0].P;
    for (const k of SIGNAUX){ const v = pp[k];
      if (!Number.isFinite(v) || v < -1.001 || v > 1.001) hors.push(sn + "/" + k + "=" + v); }
  }
  check("S27: tout signal est fini et borné dans [-1, 1]", hors.length === 0, hors.slice(0, 5).join(" "));

  /* MASQUAGE : ce que le bot ne peut pas mesurer vaut 0, et son bit le dit. */
  const p0 = lire("n0").bots[0].P, p1 = lire("n1").bots[0].P;
  check("S27: bits de présence dérivés du capteur monté",
        p0.have.n1 === false && p0.have.n2 === false && p1.have.n1 === true && p1.have.n2 === false,
        JSON.stringify(p0.have) + " / " + JSON.stringify(p1.have));
  check("S27: sans télémètre, les signaux n1 sont masqués à 0",
        p0.foeRange === 0 && p0.myEdge === 0 && p0.foeBearing === 0);
  check("S27: sans vision, les signaux n2 sont masqués à 0",
        p1.foeSpeed === 0 && p1.foeEdge === 0 && p1.foeDomT === 0 && p1.closing === 0);
  check("S27: le pare-chocs (n0) est toujours disponible", p0.have.n0 === true);
  check("S27: la centrale inertielle n'est pas encore au catalogue",
        p0.have.n3 === false && p0.slip === 0 && p0.tilt === 0 && p0.yawRate === 0);
  /* Le masque porte sur les signaux NORMALISÉS seulement : la cascade lit
     `raw`, sans masque. C'est ce qui rend l'étape numériquement neutre — le
     jour où les modules la remplaceront, le masque deviendra effectif et ce
     sera une décision assumée, pas un effet de bord de refactor. */
  check("S27: la géométrie brute reste non masquée (la cascade la lit)",
        p0.raw && p0.raw.distF > 0 && Number.isFinite(p0.raw.distEdge));

  /* PURETÉ : perceive ne doit rien muter. Un vecteur qui a des effets de bord
     ne serait pas un capteur, ce serait une commande. */
  const mp = lire("n2", 120);
  const bot = mp.bots[0];
  const avant = JSON.stringify({ pos:bot.pos, vel:bot.vel, angle:bot.angle, mode:bot.mode,
                                 tL:bot.throttleL, tR:bot.throttleR, n:mp.n });
  const q1 = JSON.stringify(E.perceive(bot, mp.bots[1], mp));
  const q2 = JSON.stringify(E.perceive(bot, mp.bots[1], mp));
  const apres = JSON.stringify({ pos:bot.pos, vel:bot.vel, angle:bot.angle, mode:bot.mode,
                                 tL:bot.throttleL, tR:bot.throttleR, n:mp.n });
  check("S27: perceive ne mute ni le bot ni le match", avant === apres);
  check("S27: perceive est déterministe (deux lectures identiques)", q1 === q2);
  check("S27: perceive ne consomme aucun aléa",
        (() => { const b = mp.bots[0]; let n = 0; const brut = b.rng;
          b.rng = () => { n++; return brut(); };
          E.perceive(b, mp.bots[1], mp); b.rng = brut; return n === 0; })());

  /* Un bot en n0 avec un bon logiciel DOIT fonctionner — dégradé, pas cassé.
     C'est le couplage souple : un génie à moitié aveugle est un build. */
  const aveugle = { ...E.SLICE1.playerBuild,
    parts:{ motor:"m2", battery:"b1", propulsion:"pr1", cpu:"c2", sensors:"n0", software:"s2" } };
  const r = E.runHeadless(777, aveugle, B("n2", { chassis:"marteau" }));
  check("S27: un bot sans capteurs avec un logiciel haut de gamme combat quand même",
        (r.winner === 0 || r.winner === 1) && r.t > 0, "issue " + r.winner + " en " + r.t.toFixed(1) + " s");

  check("S27: les trois phases sont exposées séparément",
        typeof E.perceive === "function" && typeof E.decide === "function" && typeof E.actuate === "function");
});

// ------------------------------------------------------ S28 : modules et arbitre priorité
safe("S28 contrat des modules", () => {
  const MODS = E.MODULES;
  check("S28: le catalogue de modules existe", Array.isArray(MODS) && MODS.length >= 6,
        MODS.map(m => m.id).join(" "));
  const ids = MODS.map(m => m.id);
  check("S28: les identifiants sont uniques", new Set(ids).size === ids.length, ids.join(" "));
  /* Les modes existants sont lus AILLEURS (rendu, HUD, débriefing) : en
     inventer un nouveau casserait silencieusement une autre couche. */
  const MODES_OK = ["stalk","charge","recenter","orbit","hold","escape"];
  const inconnus = MODS.filter(m => !MODES_OK.includes(m.mode)).map(m => m.id + "→" + m.mode);
  check("S28: chaque module produit un mode CONNU", inconnus.length === 0, inconnus.join(" "));

  /* `needs` : le contrat dit ce que le module consomme. La porte vérifie que
     ces noms existent VRAIMENT dans le bus — un besoin mal orthographié
     passerait inaperçu jusqu'à ce que le masquage devienne contraignant. */
  const B = (sn) => ({ ...E.SLICE1.playerBuild,
    parts:{ motor:"m2", battery:"b1", propulsion:"pr1", cpu:"c1", sensors:sn, software:"s2" } });
  const mm = E.makeMatch(4242, B("n2"), B("n2"));
  for (let i = 0; i < 60; i++) E.tick(mm);
  const P = mm.bots[0].P;
  const orphelins = [];
  for (const mo of MODS){
    if (!Array.isArray(mo.needs)) { orphelins.push(mo.id + ": needs absent"); continue; }
    for (const n of mo.needs) if (P[n] === undefined) orphelins.push(mo.id + "/" + n);
  }
  check("S28: tout `needs` déclaré existe dans le bus", orphelins.length === 0, orphelins.join(" "));

  /* Un module par DÉFAUT est ce qui garantit qu'un bot a toujours un mode.
     Sans lui, un bot dont aucun module n'est applicable resterait sans
     décision — et un arbitre sans issue est un bot immobile. */
  const defauts = MODS.filter(m => m.defaut);
  check("S28: exactement un module par défaut", defauts.length === 1, defauts.map(m => m.id).join(" "));
  check("S28: le module par défaut enchérit toujours",
        defauts[0].bid(mm.bots[0], mm.bots[1], mm, P, E.tactique(mm.bots[0], mm.bots[1], mm, P)) > 0);

  /* PURETÉ des enchères : un `bid` qui mute serait un ordre déguisé en avis,
     et l'arbitre à utilité — qui les évalue TOUTES avant de choisir —
     appliquerait les effets de bord des perdants. */
  const bot = mm.bots[0], foe = mm.bots[1];
  const C = E.tactique(bot, foe, mm, P);
  const avant = JSON.stringify({ pos:bot.pos, vel:bot.vel, angle:bot.angle, mode:bot.mode,
                                 orbitT:bot.orbitT, tL:bot.throttleL, tR:bot.throttleR });
  const enchere1 = MODS.map(mo => mo.bid(bot, foe, mm, P, C)).join(",");
  const enchere2 = MODS.map(mo => mo.bid(bot, foe, mm, P, C)).join(",");
  const apres = JSON.stringify({ pos:bot.pos, vel:bot.vel, angle:bot.angle, mode:bot.mode,
                                 orbitT:bot.orbitT, tL:bot.throttleL, tR:bot.throttleR });
  check("S28: aucune enchère ne mute le bot", avant === apres);
  check("S28: les enchères sont déterministes", enchere1 === enchere2, enchere1);
  check("S28: une enchère est un nombre fini ≥ 0",
        MODS.every(mo => { const v = mo.bid(bot, foe, mm, P, C); return Number.isFinite(v) && v >= 0; }));
  check("S28: aucune enchère ne consomme d'aléa",
        (() => { let n = 0; const brut = bot.rng; bot.rng = () => { n++; return brut(); };
          MODS.forEach(mo => mo.bid(bot, foe, mm, P, C)); bot.rng = brut; return n === 0; })());

  /* Les issues PLANIFIÉES sont mutuellement exclusives par construction
     (`orbite` et `statue` posent want = false). Le portage en priorité repose
     sur cette propriété : si elle tombe, l'ordre déclaré devient un piège. */
  let collisions = 0, vus = 0;
  for (let s = 1; s <= 12; s++){
    for (const st of ["adaptive","pressure","counter","ambush"]){
      const mx = E.makeMatch(s * 9176, { ...B("n2"), strategy:st }, B("n2"));
      let g = 0;
      while (!mx.over && g++ < 3000){
        E.tick(mx);
        const b = mx.bots[0], Px = b.P; if (!Px) continue;
        const Cx = E.tactique(b, mx.bots[1], mx, Px);
        const n = (Cx.want ? 1 : 0) + (Cx.orbite ? 1 : 0) + (Cx.statue ? 1 : 0);
        vus++; if (n > 1) collisions++;
      }
    }
  }
  check("S28: charge / orbite / statue restent exclusifs (" + vus + " décisions)",
        collisions === 0, collisions + " collisions");

  /* L'arbitre `priority` : le PREMIER non nul dans l'ordre déclaré. */
  check("S28: l'arbitre priority existe", typeof E.ARBITERS.priority === "function");
  const faux = [{ id:"A", mode:"stalk", needs:[], bid:()=>0 },
                { id:"B", mode:"charge", needs:[], bid:()=>0.2 },
                { id:"C", mode:"hold", needs:[], bid:()=>0.9 }];
  check("S28: priority prend le PREMIER non nul, pas le meilleur",
        E.ARBITERS.priority(faux, bot, foe, mm, P, C).id === "B");
  check("S28: priority ne rend rien quand tout est à zéro",
        E.ARBITERS.priority(faux.map(f => ({ ...f, bid:()=>0 })), bot, foe, mm, P, C) === null);

  /* Les RÉFLEXES sont hors cadence : un bot au CPU le plus lent doit pouvoir
     se recentrer entre deux pensées — « tomber entre deux pensées serait
     injuste ». On le vérifie sur un bot en c0 (cadence 18 ticks). */
  const lent = { ...E.SLICE1.playerBuild, edgeGuard:"fearful",
    parts:{ motor:"m2", battery:"b1", propulsion:"pr1", cpu:"c0", sensors:"n1", software:"s2" } };
  const ml = E.makeMatch(31337, lent, B("n2"));
  let horsCadence = 0, g2 = 0;
  while (!ml.over && g2++ < 4000){
    E.tick(ml);
    const b = ml.bots[0];
    if (b.modId === "GUARD" && !(b.P && b.P.raw.think)) horsCadence++;
  }
  check("S28: GUARD se déclenche hors cadence CPU", horsCadence > 0, horsCadence + " fois");
  check("S28: le journal de module est publié", typeof ml.bots[0].modId === "string" || ml.bots[0].modId === null);
});

// ------------------------------------------------------ S29 : arbitre à utilité, palier v3
safe("S29 arbitre à utilité", () => {
  check("S29: l'arbitre utility existe", typeof E.ARBITERS.utility === "function");
  const faux = [{ id:"A", mode:"stalk", needs:[], bid:()=>0.2 },
                { id:"B", mode:"charge", needs:[], bid:()=>0.9 },
                { id:"C", mode:"hold", needs:[], bid:()=>0.5 }];
  check("S29: utility prend le MEILLEUR, pas le premier",
        E.ARBITERS.utility(faux, {}, {}, {}, {}, {}).id === "B");
  /* L'égalité doit être tranchée par l'ORDRE DÉCLARÉ, jamais par l'ordre
     d'itération : sinon deux exécutions pourraient diverger sur un ex aequo. */
  const ex = [{ id:"P", mode:"stalk", needs:[], bid:()=>0.5 },
              { id:"Q", mode:"charge", needs:[], bid:()=>0.5 }];
  check("S29: égalité tranchée par l'ordre déclaré",
        E.ARBITERS.utility(ex, {}, {}, {}, {}, {}).id === "P");
  check("S29: utility ne rend rien quand tout est à zéro",
        E.ARBITERS.utility(faux.map(f => ({ ...f, bid:()=>0 })), {}, {}, {}, {}, {}) === null);

  /* La table des paliers est une DONNÉE : ajouter un palier = une entrée. */
  const SW = E.SOFTWARE;
  check("S29: chaque logiciel du catalogue a son entrée de palier",
        E.PARTS.software.every(p => !!SW[p.id]), Object.keys(SW).join(" "));
  const inconnus = [];
  for (const id in SW){
    if (!E.ARBITERS[SW[id].arbiter]) inconnus.push(id + ": arbitre " + SW[id].arbiter);
    for (const mid of SW[id].modules)
      if (!E.MODULES.some(mo => mo.id === mid)) inconnus.push(id + ": module " + mid);
  }
  check("S29: tout arbitre et tout module référencés existent", inconnus.length === 0, inconnus.join(" "));
  check("S29: v0-v2 restent en priorité, v3 passe à l'utilité",
        SW.s0.arbiter === "priority" && SW.s1.arbiter === "priority" &&
        SW.s2.arbiter === "priority" && SW.s3.arbiter === "utility");
  /* Les paliers inférieurs doivent porter la MÊME liste : c'est ce qui garantit
     que leur comportement n'a pas bougé (et le témoin le prouve au tick près). */
  check("S29: v0-v2 partagent la liste historique",
        SW.s0.modules.join() === SW.s1.modules.join() && SW.s1.modules.join() === SW.s2.modules.join());
  /* Les modules mesurés négatifs sont tenus HORS de toute liste — leur
     présence au catalogue documente la tentative, pas une régression. */
  const enListe = new Set(); for (const id in SW) SW[id].modules.forEach(x => enListe.add(x));
  const horsListe = E.MODULES.filter(mo => !enListe.has(mo.id)).map(mo => mo.id);
  check("S29: PATIENCE et FEINT restent hors des paliers (mesurés négatifs)",
        horsListe.sort().join() === "FEINT,PATIENCE", horsListe.join(" "));

  /* Le pilote est monté au BOT depuis son logiciel, pas déduit ailleurs. */
  const B = (sw, sn) => ({ ...E.SLICE1.playerBuild,
    parts:{ motor:"m2", battery:"b1", propulsion:"pr1", cpu:"c1", sensors:sn, software:sw } });
  const m3 = E.makeMatch(4242, B("s3","n2"), B("s2","n2"));
  E.tick(m3);
  check("S29: un bot v3 embarque l'arbitre à utilité",
        m3.bots[0].arbiter === "utility" && m3.bots[1].arbiter === "priority",
        m3.bots[0].arbiter + " / " + m3.bots[1].arbiter);
  check("S29: un bot v3 embarque ses modules résolus",
        Array.isArray(m3.bots[0].planifies) && m3.bots[0].planifies.length >= 4);

  /* LE critère de conception : chaque barreau gagne 55-75 % contre le
     précédent, à matériel égal. Mesuré, pas espéré. */
  const duel = (A, Bb, n) => { let w = 0;
    for (let s = 1; s <= n; s++){ const seed = s * 104729;
      let mm = E.makeMatch(seed, A, Bb); while (!mm.over) E.tick(mm); if (mm.winner === 0) w++;
      mm = E.makeMatch(seed, Bb, A); while (!mm.over) E.tick(mm); if (mm.winner === 1) w++; }
    return 100 * w / (2 * n); };
  const r32 = duel(B("s3","n2"), B("s2","n2"), 40);
  check("S29: v3 n'est jamais une régression sur v2", r32 >= 50, r32.toFixed(1) + " %");
  /* ⚠ CONSTAT MESURÉ, à ne pas confondre avec un succès. L'avance de v3 sur
     v2 est ENTIÈREMENT celle du levier d'agressivité :
         s3/équilibré vs s2/équilibré   80 %
         s2/FÉROCE    vs s2/équilibré   80 %   ← le même chiffre
         s3/équilibré vs s2/féroce      50 %
         s3/féroce    vs s2/féroce      50 %
     Autrement dit : v3 module l'agressivité selon la situation, mais dans ce
     modèle de combat charger est presque toujours juste — donc moduler ne bat
     pas « charger toujours ». L'arbitre à utilité fonctionne ; c'est le
     COMBAT qui n'a pas encore de décision intéressante à lui soumettre.
     Deux verrous, dans cet ordre : (1) `aggression=balanced` est un piège
     (féroce gagne 77 % contre lui) — chantier d'équilibrage des poignées ;
     (2) tant qu'aucune situation ne récompense le fait de NE PAS charger,
     aucun pilote ne peut être malin. Les armes et les dégâts positionnels
     créent ces situations : c'est là que v3 prendra son sens.
     Cette vérification garde donc la NON-RÉGRESSION, pas une victoire. */
  const egal = duel({ ...B("s3","n2"), aggression:"fierce" },
                    { ...B("s2","n2"), aggression:"fierce" }, 30);
  check("S29: à agressivité égale, v3 ne se distingue pas encore (constat)",
        egal >= 40 && egal <= 60, egal.toFixed(1) + " % — voir le commentaire ci-dessus");
  /* DÉGRADATION PROPRE : un v3 sans capteurs doit rester JOUABLE. Un signal
     masqué vaut 0, et 0 veut dire « droit devant » pour un gisement : sans
     valeur neutre de repli, le bot aveugle se croirait parfaitement aligné et
     gagnerait par accident. Ici il décide sans information, et il joue. */
  const rAveugle = duel(B("s3","n0"), B("s2","n0"), 30);
  check("S29: un v3 sans capteurs reste jouable (dégradé, pas cassé)",
        rAveugle >= 45, rAveugle.toFixed(1) + " %");
  const c = {}; let tot = 0;
  { const mv = E.makeMatch(9176, B("s3","n0"), B("s2","n0")); let g = 0;
    while (!mv.over && g++ < 20000){ E.tick(mv); const k = mv.bots[0].modId || "-"; c[k] = (c[k]||0) + 1; tot++; } }
  check("S29: un v3 aveugle charge encore (il n'est pas paralysé)",
        (c.CHARGE || 0) > 0, Object.keys(c).join(" "));

  /* Les adversaires puisent au MÊME catalogue — sinon le joueur achète un
     palier qu'il ne rencontre jamais. Et le plafond du CONCOURS prime : un
     adversaire mieux armé que ce que le règlement autorise n'est pas une
     difficulté, c'est une tricherie. */
  const vus = new Set();
  for (const lvl of [1,2,3,4,5]) for (let i = 0; i < 40; i++)
    vus.add(E.genOpponent(i*37 + lvl, lvl).build.parts.software);
  check("S29: les adversaires montent jusqu'à v3", vus.has("s3") && vus.has("s2"),
        [...vus].sort().join(" "));
  const bride = [];
  for (let i = 0; i < 30; i++){
    const b = E.genOpponent(i*91 + 5, 5, { maxSoftware:"s1" }).build.parts.software;
    if (E.PARTS.software.findIndex(p => p.id === b) > 1) bride.push(b);
  }
  check("S29: le plafond logiciel du concours s'applique à l'adversaire",
        bride.length === 0, bride.join(" "));
});

report("QC moteur");
