// tools/qc_editor.js — the packer. Every chassis × every part must place legally.
const { openWorld } = require("./world.js");
const { check, safe, report } = require("./check.js");

const w = openWorld();
check("démarrage sans erreur", w.errors.length === 0, w.errors[0] || "");

const CHASSIS = w.eval("Object.keys(CHASSIS_SPEC)");
const SLOTS = w.eval("JSON.stringify(Object.keys(AB().equipped))") && w.eval("Object.keys(AB().equipped)");

// helper run inside the page
w.eval(`
  function __mkBuild(ch, over, counts){
    const eq = {...AB().equipped, ...(over||{})};
    return { chassis: ch, parts: eq, counts: counts||{} };
  }
  function __resetBot(){
    const b = newBotInto(S.inv, "boxy"); refit(b);
    S.garage[S.activeBot] = b;
    syncActive(); recomputeOwned(); autoArrangeCurrent();
  }
  function __placeOK(ch, over, counts){
    const b = __mkBuild(ch, over, counts);
    const lay = autoArrange(b);
    return { ok: layoutValid(b, lay), slots: Object.keys(lay).length, lay };
  }
`);

// -------------------------------------------------- every chassis packs stock
safe("stock packing", () => {
  w.eval("__resetBot()");
  let bad = [];
  for (const ch of CHASSIS) {
    const r = w.eval(`__placeOK(${JSON.stringify(ch)})`);
    if (!r.ok) bad.push(ch);
  }
  check(`${CHASSIS.length} châssis: rangement stock valide`, bad.length === 0, bad.join(",") || "—");
});

// --------------------------------- tryEquip integrity across the whole parts matrix
// A part too big for a small chassis is DESIGN, not a bug: tryEquip must refuse it
// and revert cleanly. What must never happen is a bot left in an invalid state.
safe("tryEquip integrity", () => {
  w.eval("__resetBot()");
  const slots = w.eval("Object.keys(ENGINE.PARTS)");
  let tested = 0, accepted = 0, refused = 0, broken = [];
  for (const ch of CHASSIS) {
    w.eval(`AB().chassis = ${JSON.stringify(ch)}; autoArrangeCurrent();`);
    for (const slot of slots) {
      const ids = w.eval(`ENGINE.PARTS[${JSON.stringify(slot)}].map(p=>p.id)`);
      for (const id of ids) {
        tested++;
        const before = w.eval(`S.parts.equipped[${JSON.stringify(slot)}]`);
        const ok = w.eval(`tryEquip(${JSON.stringify(slot)}, ${JSON.stringify(id)})`);
        const after = w.eval(`S.parts.equipped[${JSON.stringify(slot)}]`);
        const valid = w.eval(`layoutValid({chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}}, AB().layout)`);
        const expected = w.eval(`normEquip(${JSON.stringify(slot)}, ${JSON.stringify(id)})`);
        if (ok) { accepted++; if (after !== expected || !valid) broken.push(`accepté mais invalide ${ch}/${slot}=${id}`); }
        else    { refused++; if (after !== before)        broken.push(`refusé sans restaurer ${ch}/${slot}=${id}`); }
      }
    }
  }
  check(`${tested} équipements: état jamais corrompu`, broken.length === 0, broken.slice(0,3).join(" ") || "—");
  check("le refus existe vraiment (grosses pièces sur petits châssis)", refused > 0,
        accepted + " acceptés / " + refused + " refusés");
  w.eval(`AB().chassis = "boxy"; autoArrangeCurrent();`);
});

// ------------------------------------------------------- stacking placement
safe("stacking placement", () => {
  w.eval("__resetBot()");
  const stackable = w.eval("Object.keys(STACK_SLOTS)");
  check("slots empilables = moteur/batterie/cooling/lest",
        stackable.sort().join(",") === "ballast,battery,cooling,motor", stackable.join(","));

  // N instances must all be placed, and the layout must stay legal
  let bad = [];
  for (const ch of CHASSIS) {
    for (const slot of stackable) {
      const r = w.eval(`__placeOK(${JSON.stringify(ch)}, null, {${JSON.stringify(slot)}: 2})`);
      const has1 = w.eval(`!!__placeOK(${JSON.stringify(ch)}, null, {${JSON.stringify(slot)}: 2}).lay[${JSON.stringify(slot + "#1")}]`);
      if (!r.ok || !has1) bad.push(`${ch}/${slot}`);
    }
  }
  check("×2 de chaque slot empilable, sur chaque châssis", bad.length === 0, bad.join(" ") || "—");

  // the cap must be a real cap, not an infinite loop or a silent overflow
  const capped = w.eval(`(()=>{ S.bolts = 1e9; for(let i=0;i<40;i++) setCount("motor", +1); return AB().counts.motor; })()`);
  check("empilement plafonné par la place", capped > 1 && capped < 40, "n=" + capped);
  check("mise en page toujours valide après plafonnement",
        w.eval(`layoutValid({chassis:AB().chassis, parts:{...AB().equipped}, counts:{...AB().counts}}, AB().layout)`));
  w.eval(`(()=>{ while((AB().counts.motor||1) > 1) setCount("motor", -1); })()`);
});

// ---------------------------------------------------------- geometry integrity
safe("geometry", () => {
  w.eval("__resetBot()");
  let overlaps = 0, outside = 0, n = 0;
  for (const ch of CHASSIS) {
    const lay = w.eval(`__placeOK(${JSON.stringify(ch)}).lay`);
    const entries = Object.entries(lay);
    // cells occupied per layer must not collide
    const byLayer = {};
    for (const [slot, pos] of entries) {
      const id = w.eval(`idAt(__mkBuild(${JSON.stringify(ch)}), ${JSON.stringify(slot)})`);
      // unmounted weapon slots are parked and occupy no space — by design
      if (!w.eval(`isMounted(${JSON.stringify(slot)}, ${JSON.stringify(id)})`)) continue;
      const L = w.eval(`layerOf(${JSON.stringify(slot)})`);
      const f = w.eval(`footprintOf(${JSON.stringify(slot)}, ${JSON.stringify(id)})`);
      (byLayer[L] = byLayer[L] || []).push({ slot, pos, f });
    }
    for (const L of Object.keys(byLayer)) {
      const items = byLayer[L];
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j]; n++;
        const sep = a.pos.col + a.f.w <= b.pos.col || b.pos.col + b.f.w <= a.pos.col ||
                    a.pos.row + a.f.d <= b.pos.row || b.pos.row + b.f.d <= a.pos.row;
        if (!sep) overlaps++;
      }
    }
  }
  check(`${n} paires de pièces: aucun chevauchement intra-couche`, overlaps === 0, overlaps);

  // centre of gravity must be finite and inside the chassis bounds
  let cgBad = [];
  for (const ch of CHASSIS) {
    const cg = w.eval(`(()=>{ const b=__mkBuild(${JSON.stringify(ch)}); return computeCG(b, autoArrange(b)); })()`);
    const ok = cg && [cg.cgX, cg.cgY, cg.cgZ, cg.mass, cg.stability].every(isFinite) && cg.stability > 0 && cg.mass > 0;
    if (!ok) cgBad.push(ch);
  }
  check("CG fini et stabilité > 0 sur chaque châssis", cgBad.length === 0, cgBad.join(",") || "—");

  // colliders must exist and be finite
  let colBad = [];
  for (const ch of CHASSIS) {
    const cols = w.eval(`(()=>{ const b=__mkBuild(${JSON.stringify(ch)}); return buildColliders(b, autoArrange(b)); })()`);
    const bad = !cols || !cols.list || !cols.list.length ||
                cols.list.some(c => ![c.x, c.y, c.r].every(isFinite) || c.r <= 0) ||
                !isFinite(cols.bound);
    if (bad) colBad.push(ch);
  }
  check("hitbox non vide et finie sur chaque châssis", colBad.length === 0, colBad.join(",") || "—");
});

// ------------------------------------------------------ layout repair contract
safe("repair", () => {
  w.eval("__resetBot()");
  // a stale/illegal saved layout must be repaired, not crash and not stay illegal
  w.eval(`AB().layout = { motor: {col:99, row:99}, junkSlot: {col:0,row:0} };`);
  const lay = w.eval(`getLayout()`);
  check("mise en page corrompue réparée automatiquement",
        !!lay && w.eval(`layoutValid({chassis:AB().chassis, parts:{...AB().equipped}, counts:{...AB().counts}}, getLayout())`));
  check("aucune erreur pendant la réparation", w.errors.length === 0, w.errors[0] || "");
});

// ------------------------------------------------------ A1: taxonomie en données
safe("taxonomie", () => {
  check("3 paliers déclarés, ids uniques",
        w.eval("TIERS.length===3 && Object.keys(TIER_BY_ID).length===3"));
  check("palier inconnu → repli beetle",
        w.eval("tierOf('nimporte_quoi').id === 'beetle'"));
  check("grille beetle 10×10 par défaut",
        w.eval("gridW('boxy')===10 && gridH('boxy')===10 && gridCX('boxy')===5"));
  check("bandes de classes portées par le palier",
        w.eval("chassisClassOf('boxy') === 'M'"),
        w.eval("chassisClassOf('boxy')"));
  // preuve vivante : basculer un châssis sur 'feather' change grille ET classement,
  // sans casser la géométrie de coque (le masque est indépendant de la grille).
  const cellsBefore = w.eval("chassisCells('boxy')");
  w.eval("CHASSIS_TIER.boxy='feather'");
  check("bascule de palier : la grille suit (16×12)",
        w.eval("gridW('boxy')===16 && gridH('boxy')===12"));
  check("bascule de palier : cellules de coque inchangées",
        w.eval("chassisCells('boxy')") === cellsBefore);
  check("bascule de palier : classement relu dans les bandes du palier",
        w.eval("chassisClassOf('boxy')==='S'"),   // 36 cellules ≤ 61 → S en feather
        w.eval("chassisClassOf('boxy')"));
  check("miroir stable sur grille élargie (involution)",
        w.eval("mirrorCol('boxy', mirrorCol('boxy', 3, 2), 2) === 3"));
  w.eval("delete CHASSIS_TIER.boxy");
  check("retour beetle propre", w.eval("gridW('boxy')===10 && chassisClassOf('boxy')==='M'"));
  check("aucune erreur pendant les bascules", w.errors.length === 0, w.errors[0] || "");
});

// ------------------------------------------------------ S16-WHEELS : longerons procéduraux
safe("longerons S16", () => {
  const r = w.eval(`(function(){
    const out = {};
    const f = {w:1, d:2, h:6};                                  // empreinte littérale (pr0 est passé 1×1 en S16-EDIT)
    // marteau, taille (rangées 2-4, coque cols 3-6) : roue col 0 → écart 2, pontable
    const b1 = beamsForWheel("marteau", {col:0,row:2}, f);
    out.waist = { valid:b1.valid, cells:b1.cells, bars:b1.bar ? 1 : 0,
                  rowC:b1.bar && b1.bar.rowC };            // UNE barre, centrée sur le pod
    // écart 3 (col -1 à la taille) : aucune rangée attachable → refusé
    const b2 = beamsForWheel("marteau", {col:-1,row:2}, f);
    out.tooFar = b2.valid;
    // épaule (rangée 0, coque dès col 1) : attache directe, zéro longeron
    const b3 = beamsForWheel("marteau", {col:0,row:0}, f);
    out.shoulder = { valid:b3.valid, cells:b3.cells };
    // placementOK suit la même règle (bornes comprises)
    out.placeWaist = placementOK("marteau", "propulsion", {col:0,row:2}, []);
    out.placeTooFar = placementOK("marteau", "propulsion", {col:-1,row:2}, []);
    // masse : exactement n × BEAM_KG, et la pesée voit la différence
    const base = ENGINE.physStats({chassis:"marteau", parts:{}}).massKg;
    const heavy = ENGINE.physStats({chassis:"marteau", parts:{}, beamCells:8}).massKg;
    out.massDelta = Math.round((heavy-base)*1000)/1000;
    // colliders : 4 cellules de longeron par côté, slot null (choc = coque)
    const build = { chassis:"marteau", parts:{} };
    const L = autoArrange(build); L.propulsion = {col:0,row:2};
    const cols = buildColliders(build, L);
    out.beamColl = cols.list.filter(k=>k.slot===null).length;
    // CG : stabilité finie, et l'écart déplace la mesure
    const cgTight = computeCG(build, {...L, propulsion:{col:0,row:0}}).stability;
    const cgWide  = computeCG(build, L).stability;
    out.cgOK = isFinite(cgTight) && isFinite(cgWide) && cgTight !== cgWide;
    // trio S par défaut : ZÉRO longeron → l'équilibre 1,36 kg PILE est intact
    const sB = { chassis:"tortue_s", parts:{motor:"m1",battery:"b1",propulsion:"pr1"} };
    out.trioBeams = beamCellsOf(sB, autoArrange(sB));
    return out;
  })()`);
  check("S16W: taille du marteau pontée par UNE barre de 2 cellules, centrée sur la roue",
        r.waist && r.waist.valid && r.waist.cells === 2 && r.waist.bars === 1 && r.waist.rowC === 3,
        JSON.stringify(r.waist));
  check("S16W: écart 3 refusé, épaule = attache directe sans longeron",
        r.tooFar === false && r.shoulder && r.shoulder.valid && r.shoulder.cells === 0,
        JSON.stringify({tooFar:r.tooFar, shoulder:r.shoulder}));
  check("S16W: placementOK autorise la taille, refuse l'écart 3",
        r.placeWaist === true && r.placeTooFar === false, r.placeWaist+"/"+r.placeTooFar);
  check("S16W: masse = 8 cellules × 18 g", r.massDelta === 0.144, r.massDelta);
  check("S16W: 4 colliders de longeron (pr0 1×1 : 1 rangée × 2 cellules × 2 côtés)", r.beamColl === 4, r.beamColl);
  check("S16W: le CG sent l'empattement", r.cgOK === true, String(r.cgOK));
  check("S16W: trio S par défaut sans longeron (1,36 kg PILE préservé)", r.trioBeams === 0, r.trioBeams);
  check("S16W: aucune erreur", w.errors.length === 0, w.errors[0] || "");
});

// ------------------------------------------------------ S16-EDIT : éditeur A
safe("éditeur S16-A", () => {
  const r = w.eval(`(function(){
    const out = {};
    // pr0 est un élément d'un seul slot
    out.pr0 = footprintOf("propulsion", "pr0");
    // INCRÉMENTAL : config Petit Rusty (petites pièces), puis 2e moteur —
    // roues et pièces en place ne bougent PAS (le bug playtest exact)
    const b1 = { chassis:"tortue_s", parts:{motor:"m0",battery:"b0",propulsion:"pr0",cpu:"c0"} };
    const L1 = autoArrange(b1);
    const b2 = { ...b1, counts:{ motor:2 } };                  // + moteur m0 n°2
    const L2 = repairLayout(b2, L1);
    out.wheelsKept = JSON.stringify(L2.propulsion) === JSON.stringify(L1.propulsion);
    out.othersKept = ["motor","battery","cpu"].every(s =>
      JSON.stringify(L2[s]) === JSON.stringify(L1[s]));
    out.newPlaced = !!L2["motor#1"] && !L2.__nofit;
    out.valid = layoutValid(b2, L2);
    // repli honnête : demande impossible → autoArrange (__nofit assumé)
    const b3 = { ...b1, counts:{ motor:6 } };
    out.fallback = !!repairLayout(b3, L1).__nofit;
    // fenêtres par classe : S ≈ 8,6 cellules (26 cm), M reste 10 (30 cm)
    const winS = 2*BOARD_HALF/viewParams("tortue_s").cell;
    const winM = 2*BOARD_HALF/viewParams("boxy").cell;
    out.winS = Math.round(winS*10)/10; out.winM = Math.round(winM*10)/10;
    // bornes alpha : en jsdom l'image est illisible → repli plein cadre, jamais de jet
    const fake = { src:"x", complete:true, naturalWidth:100, naturalHeight:60 };
    const ab = spriteAlphaBounds(fake);
    out.abFallback = ab.x===0 && ab.y===0 && ab.w===100 && ab.h===60;
    return out;
  })()`);
  check("S16A: pr0 occupe 1×1", r.pr0 && r.pr0.w===1 && r.pr0.d===1, JSON.stringify(r.pr0));
  check("S16A: 2e moteur — roues immobiles, pièces en place conservées, nouveau logé",
        r.wheelsKept && r.othersKept && r.newPlaced && r.valid,
        JSON.stringify({w:r.wheelsKept,o:r.othersKept,n:r.newPlaced,v:r.valid}));
  check("S16A: incrémental impossible → repli autoArrange assumé", r.fallback === true, String(r.fallback));
  check("S16A: fenêtre éditeur S ≈ 8,6 cellules, M = 10",
        r.winS >= 8.4 && r.winS <= 8.8 && r.winM === 10, r.winS + "/" + r.winM);
  check("S16A: bornes alpha — repli plein cadre sans erreur", r.abFallback === true, String(r.abFallback));
  check("S16A: aucune erreur", w.errors.length === 0, w.errors[0] || "");
});

// ------------------------------------------------------ S21 : __nofit ⇒ coque seule
safe("S21 garde de mise en page sur les colliders", () => {
  /* Un build qui ne loge pas empilait tout en {0,0} : la roue miroir partait
     hors grille et la boîte de collision atteignait 5× le rayon de coque —
     une hitbox plus large que la moitié du ring S. */
  const r = JSON.parse(w.eval(`(function(){
    const out=[];
    for (const ch of Object.keys(CHASSIS_SPEC)){
      const stock={}; for (const sl in ENGINE.PARTS) stock[sl] = OPTIONAL_SLOTS[sl] ? null : ENGINE.PARTS[sl][0].id;
      const bStock={chassis:ch, parts:stock, counts:{}};
      const LStock=autoArrange(bStock);
      if (LStock.__nofit) continue;                       // coque qui ne loge même pas son stock : hors sujet
      const boundStock=buildColliders(bStock,LStock).bound;
      // un build volontairement trop gros pour la coque
      const gros={...stock, motor:"m3", battery:"b3", propulsion:"pr3", cpu:"c2", sensors:"n2"};
      const bGros={chassis:ch, parts:gros, counts:{motor:3, battery:3}};
      const LGros=autoArrange(bGros);
      if (!LGros.__nofit) continue;                       // il loge : rien à garder ici
      out.push({ch, nofit:+buildColliders(bGros,LGros).bound.toFixed(2), stock:+boundStock.toFixed(2)});
    }
    return JSON.stringify(out);})()`));
  check("S21: au moins une coque met la garde à l'épreuve", r.length > 0, r.length + " coques");
  const bad = r.filter(x => x.nofit > x.stock * 1.25);
  check("S21: une mise en page échouée ne dépasse jamais la coque garnie",
        bad.length === 0, bad.map(x => x.ch + " " + x.nofit + " > " + x.stock).join(" | "));
  check("S21: aucune erreur", w.errors.length === 0, w.errors[0] || "");
});

// ------------------------------------------------------ CALIBRAGE : les étalons LOGENT
safe("étalons plaçables", () => {
  /* Un étalon qui ne loge pas dans sa coque n'est pas une règle graduée : il
     combat avec la garde S21 (coque seule) et ne mesure plus ce qu'il annonce. */
  const r = JSON.parse(w.eval(`(function(){
    const out=[];
    for (const id in ENGINE.BENCHMARKS){
      const b = ENGINE.BENCHMARKS[id].build;
      const L = autoArrange(b);
      const tr = TOURNAMENTS.find(t => t.benchmark === id);
      out.push({ id, fit: !(L && L.__nofit) && layoutValid(b, L),
                 classe: chassisClassOf(b.chassis),
                 attendue: tr && tr.rules ? tr.rules.chassisClass : null,
                 kg: +ENGINE.physStats(b).massKg.toFixed(3) });
    } return JSON.stringify(out);})()`));
  const nofit = r.filter(x => !x.fit).map(x => x.id);
  check("étalons : tous logent dans leur coque", nofit.length === 0, nofit.join(" "));
  const mism = r.filter(x => x.attendue && x.classe !== x.attendue)
                .map(x => x.id + " " + x.classe + "≠" + x.attendue);
  check("étalons : la classe réelle est celle annoncée par l'épreuve", mism.length === 0, mism.join(" "));
  check("étalons : chaque étalon a son épreuve dans la Ligne Calibrage",
        r.every(x => x.attendue != null),
        r.filter(x => x.attendue == null).map(x => x.id).join(" "));
});

// ------------------------------------------------------ S23 : adversaires PLAÇABLES
safe("S23 adversaires générés plaçables", () => {
  const r = JSON.parse(w.eval(`(function(){
    const out = {};
    for (const cid of ["sumoS","sparS","cupS","lightM","cupM"]){
      for (const lvl of [1,2,3,4,5]){
        let brut = 0, restant = 0;
        for (let i = 0; i < 24; i++){
          const o = opponentOpts(cid);
          if (!fitsOnHull(ENGINE.genOpponent(700 + i*31, lvl, o).build)) brut++;
          if (!fitsOnHull(genOpponentFit(700 + i*31, lvl, o).build)) restant++;
        }
        out[cid + "/" + lvl] = [brut, restant];
      }
    }
    return JSON.stringify(out);})()`));
  const restants = Object.entries(r).filter(([, v]) => v[1] > 0).map(([k, v]) => k + ":" + v[1]);
  check("S23: aucun adversaire généré ne reste hors coque", restants.length === 0, restants.join(" "));
  const soignes = Object.entries(r).filter(([, v]) => v[0] > 0).map(([k, v]) => k + " " + v[0] + "→0");
  check("S23: la réparation a bien du travail (sinon le test ne prouve rien)",
        soignes.length > 0, soignes.join(" · "));
  /* La réparation ne doit jamais REMONTER une pièce en gamme : un adversaire
     réparé est toujours ≤ à l'adversaire tiré, jamais un cadeau déguisé. */
  const monte = w.eval(`(function(){
    const bad = [];
    for (let i = 0; i < 30; i++){
      const o = opponentOpts("sumoS");
      const a = ENGINE.genOpponent(3300 + i*7, 4, o).build;
      const b = genOpponentFit(3300 + i*7, 4, o).build;
      for (const sl in ENGINE.PARTS){
        const ia = ENGINE.PARTS[sl].findIndex(p => p.id === a.parts[sl]);
        const ib = ENGINE.PARTS[sl].findIndex(p => p.id === b.parts[sl]);
        if (ib > ia) bad.push(sl + " " + a.parts[sl] + "→" + b.parts[sl]);
      }
    }
    return bad.join(" ");})()`);
  check("S23: la réparation ne remonte jamais une pièce en gamme", monte === "", monte);
  // déterminisme : la réparation ne casse pas la reproductibilité par graine
  check("S23: même graine → même adversaire réparé",
        w.eval(`JSON.stringify(genOpponentFit(4242, 4, opponentOpts("sumoS")).build)
             === JSON.stringify(genOpponentFit(4242, 4, opponentOpts("sumoS")).build)`));
  check("S23: aucune erreur", w.errors.length === 0, w.errors[0] || "");
});

// ------------------------------------------------------ E4b : plafond S porté à 1,42
safe("E4b plafond S 1,42", () => {
  const caps = JSON.parse(w.eval(`JSON.stringify(["sumoS","sparS","cupS"]
    .map(id => tournamentById(id).rules.metrics.weightKg))`));
  check("E4b: les trois épreuves S plafonnent à 1,42 kg",
        caps.every(c => c === 1.42), caps.join(" "));
  /* Ce que 1,42 achète, MESURÉ : l'axe pilote (CPU + capteur) devient légal
     par-dessus les roues sur les coques lourdes, ce que 1,36 interdisait
     (le trio pesait 1,360 PILE avec CPU et capteur d'origine). */
  const r = JSON.parse(w.eval(`(function(){
    const mk = (ch, over) => { const parts = {};
      for (const sl in ENGINE.PARTS) parts[sl] = OPTIONAL_SLOTS[sl] ? null : ENGINE.PARTS[sl][0].id;
      Object.assign(parts, over); return { chassis: ch, parts, counts: {} }; };
    const out = {};
    for (const ch of ["tortue_s","hex_s","coin_s","losange_s"]){
      const b = mk(ch, { propulsion:"pr1", cpu:"c1", sensors:"n1" });
      out[ch] = { kg: +ENGINE.physStats(b).massKg.toFixed(3),
                  loge: fitsOnHull(b),
                  ok142: checkEntry(b, tournamentById("sumoS").rules).ok };
    }
    return JSON.stringify(out);})()`));
  const gagnants = Object.entries(r).filter(([, v]) => v.loge && v.kg > 1.36 && v.ok142);
  check("E4b: des coques S gagnent l'axe pilote grâce au nouveau plafond",
        gagnants.length > 0, gagnants.map(([k, v]) => k + " " + v.kg).join(" · "));
  check("E4b: roues + CPU + capteur homologué sur toutes les coques légères",
        Object.entries(r).filter(([, v]) => v.loge).every(([, v]) => v.ok142),
        JSON.stringify(r));
});

w.close();
report("QC éditeur");


// ------------------------------------------------------ S31 : saisie des roues (regression e37/v72)
safe("S31 saisie des roues", () => {
  const w = openWorld();
  const r = w.eval(`(function(){
    const L = getLayout(), p = L.propulsion;
    const f = footprintOf("propulsion", idAt(AB(), "propulsion"));
    const mc = mirrorCol(AB().chassis, p.col, f.w);
    const out = { gauche:null, droite:null, jet:null };
    try {
      out.gauche = editorHit(L, {col:p.col+0.5, row:p.row+0.5});
      out.droite = editorHit(L, {col:mc+0.5,    row:p.row+0.5});
    } catch(e){ out.jet = e.message; }
    return JSON.stringify(out);
  })()`);
  const o = JSON.parse(r);
  /* v72 : `build.chassis` dans editorHit(layout, cell) — ReferenceError a CHAQUE
     doigt pose sur une roue. Le geste mourait et le journal se remplissait. */
  check("S31: saisir une roue ne jette pas", o.jet === null, o.jet || "aucune exception");
  check("S31: la roue gauche se saisit", o.gauche === "propulsion", String(o.gauche));
  check("S31: la roue MIROIR se saisit (chemin qui jetait)", o.droite === "propulsion", String(o.droite));
  check("S31: aucune erreur de page", w.errors.length === 0, w.errors[0] || "");
  w.close();
});


// ------------------------------ S32 : un bot AU FORMAT SAUVEGARDE doit pouvoir combattre
safe("S32 pilote normalise a l'entree", () => {
  const w = openWorld();
  /* Le trou par lequel c'est passe : genOpponent construit ses builds A PLAT,
     donc porte et temoin exercaient une forme que le joueur n'a jamais. Ici on
     part d'une VRAIE fiche de sauvegarde — pilote imbrique, aucune cle a plat —
     et on fait tourner des manches completes. */
  const FICHE = {
    rc:1, chassis:"marteau",
    parts:{propulsion:"pr3",motor:"m3",cpu:"c2",battery:"b2",software:"s2",
           ballast:"l1",sensors:"n2",srimech:"r2",cooling:"k2"}, counts:{},
    pilot:{strategy:"pressure",aggression:"fierce",edgeGuard:"normal",approach:"frontal",
           power:"torque",chargeDist:"medium",handling:"nervous"},
    layout:{propulsion:{col:1,row:0},cooling:{col:3,row:0},weapon1:{col:0,row:0},
            weapon2:{col:0,row:0},battery:{col:3,row:3},motor:{col:1,row:5},
            srimech:{col:4,row:5},cpu:{col:7,row:5,floor:0},sensors:{col:7,row:6},
            ballast:{col:6,row:0}},
    color:"#d98a45", stickers:[] };
  const r = w.eval(`(function(){
    const F = ${JSON.stringify(FICHE)};
    const P = buildOfBot(F);
    const manquant = PILOT_KEYS.filter(k => P[k] === undefined);
    const ring = CLASS_RING.M/2*(6.2/3);
    let finies = 0, total = 0, jet = null, deplMin = 1e9;
    try {
      for (let lvl = 3; lvl <= 5; lvl++){
        const opp = ENGINE.genTournament(1234, lvl);
        for (let i = 0; i < opp.length; i++){
          const m = ENGINE.makeMatch(7+i, P, opp[i].build, {arenaR:ring});
          const p0 = {x:m.bots[0].pos.x, y:m.bots[0].pos.y};
          let d = 0;
          while (!m.over && m.t < 180){ ENGINE.tick(m);
            d = Math.max(d, Math.hypot(m.bots[0].pos.x-p0.x, m.bots[0].pos.y-p0.y)); }
          total++; if (m.over) finies++; deplMin = Math.min(deplMin, d);
        }
      }
    } catch(e){ jet = e.message; }
    return JSON.stringify({manquant, finies, total, jet, deplMin:Math.round(deplMin),
                           handling:P.handling, imbrique:F.pilot.handling});
  })()`);
  const o = JSON.parse(r);
  check("S32: buildOfBot aplatit toutes les cles de pilote",
        o.manquant.length === 0, o.manquant.join(",") || "aucune manquante");
  check("S32: la cle imbriquee arrive bien au moteur",
        o.handling === o.imbrique, o.handling + " vs " + o.imbrique);
  check("S32: aucun jet pendant les manches", o.jet === null, o.jet || "aucun");
  check("S32: toutes les manches se terminent", o.finies === o.total && o.total > 0,
        o.finies + "/" + o.total);
  check("S32: le bot se deplace vraiment (pas fige)", o.deplMin > 30, o.deplMin + " u");
  w.close();
});


// ---------------- S35 : les deux notions de « rien » ne doivent pas diverger
safe("S35 pieces nulles", () => {
  const w = openWorld();
  /* Deux definitions de « rien » cohabitent :
       NONE_AT_0[slot]   — liste a la main, pilote isMounted (n'occupe aucune cellule)
       OPTIONAL_SLOTS[s] — DERIVE de (cout 0 && masse 0), pilote la boutique/inventaire
     Quand elles divergent, on obtient un objet qui coute, s'use et n'existe pas —
     c'etait le cas de n0 « Pare-chocs », 10 g fantomes. Invariant : tout slot
     NONE_AT_0 doit avoir un index 0 gratuit ET sans masse. */
  const r = w.eval(`(function(){
    const bad = [], vendus = [];
    for (const sl of Object.keys(NONE_AT_0)){
      const p = ENGINE.PARTS[sl][0], kg = ENGINE.partMassKg(sl, p.id);
      if (!OPTIONAL_SLOTS[sl] || p.cost !== 0 || kg !== 0)
        bad.push(sl + "/" + p.id + " cout=" + p.cost + " kg=" + kg);
    }
    // aucune piece « rien » ne doit etre achetable
    for (const sl of Object.keys(ENGINE.PARTS)){
      const p = ENGINE.PARTS[sl][0];
      if (!isMounted(sl, p.id) && p.cost > 0) vendus.push(sl + "/" + p.id);
    }
    return JSON.stringify({bad, vendus, n0kg: ENGINE.partMassKg("sensors","n0")});
  })()`);
  const o = JSON.parse(r);
  check("S35: tout slot NONE_AT_0 a un index 0 gratuit et sans masse",
        o.bad.length === 0, o.bad.join(" · ") || "aucune divergence");
  check("S35: aucune piece « rien » n'a de prix", o.vendus.length === 0,
        o.vendus.join(" · ") || "aucune");
  check("S35: n0 ne pese plus rien", o.n0kg === 0, o.n0kg + " kg");
  w.close();
});
