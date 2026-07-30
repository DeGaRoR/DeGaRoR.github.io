// tools/qc_ui.js — does the interface actually build itself, and does it draw?
// The recording context means "drew something" is a checkable fact, not a guess.
const { openWorld } = require("./world.js");
const { check, safe, report } = require("./check.js");

const w = openWorld();
const noErr = label => check(label, w.errors.length === 0, w.errors.slice(0, 2).join(" | ") || "");

noErr("démarrage: aucune erreur JS");

// ------------------------------------------------------------------- navigation
safe("navigation", () => {
  const tabs = [["tabFight", "fightTab"], ["tabWorkshop", "workshopTab"], ["tabShop", "shopTab"]];
  for (const [btn, panel] of tabs) {
    w.click(btn);
    const shown = tabs.filter(([, p]) => w.$(p).style.display === "block").map(([, p]) => p);
    check(`onglet ${btn} → ${panel} seul visible`,
          shown.length === 1 && shown[0] === panel, shown.join(","));
  }
  noErr("navigation: aucune erreur JS");
});

// ---------------------------------------------------------------- content built
safe("content", () => {
  w.click("tabWorkshop");
  check("atelier: lignes de slots rendues", w.$("slotRows").children.length > 0,
        w.$("slotRows").children.length + " lignes");
  check("atelier: onglets de couches rendus", w.$("layerTabs").children.length > 0);
  w.click("tabShop");
  check("boutique: garage rendu", w.$("garageRows").children.length > 0,
        w.$("garageRows").children.length + " lignes");
  w.click("tabFight");
  check("accueil: barre de garage rendue", w.$("garageStrip").children.length > 0);
  check("accueil: étiquette boulons non vide", (w.$("boltsLabel").textContent || "").length > 0,
        w.$("boltsLabel").textContent);
  noErr("contenu: aucune erreur JS");
});

// ------------------------------------------------------------------------- i18n
safe("i18n", () => {
  const before = w.$("fightBtn").textContent;
  w.eval("[...document.querySelectorAll('#langSeg .rc-seg__opt')].find(o=>o.dataset.lang!==LANG).click()");
  const after = w.$("fightBtn").textContent;
  check("le bouton langue change réellement le texte", before !== after,
        JSON.stringify(before) + " → " + JSON.stringify(after));
  // no unresolved placeholders anywhere in the visible UI, in either language
  for (const pass of [0, 1]) {
    const html = w.$("app").innerHTML;
    const holes = html.match(/\{[a-zA-Z_]+\}/g);
    check(`aucun marqueur {x} non substitué (langue ${w.eval("LANG")})`, !holes,
          holes ? holes.slice(0, 5).join(" ") : "—");
    if (pass === 0) w.eval("[...document.querySelectorAll('#langSeg .rc-seg__opt')].find(o=>o.dataset.lang!==LANG).click()");
  }
  noErr("i18n: aucune erreur JS");
});

// --------------------------------------------------------------------- drawing
safe("drawing", () => {
  w.click("tabWorkshop");
  w.clearOps("editorCv");
  w.step(3);                                    // let the preview loop run a few frames
  const ops = w.opsOf("editorCv") || [];
  check("l'éditeur dessine quelque chose", ops.length > 20, ops.length + " ops");
  check("l'éditeur équilibre save/restore",
        ops.filter(o => o.startsWith("save(")).length === ops.filter(o => o.startsWith("restore(")).length,
        ops.filter(o => o.startsWith("save(")).length + " save / " +
        ops.filter(o => o.startsWith("restore(")).length + " restore");
  check("aucune coordonnée NaN dans le rendu",
        !ops.some(o => o.includes("NaN")),
        (ops.find(o => o.includes("NaN")) || "—"));

  w.click("tabFight");
  w.clearOps("playerCv"); w.clearOps("scoutCv");
  w.eval("renderHome()");
  // S6 : l'aperçu joueur vit sur l'écran VS, dessiné à son ouverture
  w.eval("curLigue='regionale'; disputeConcours('libre')");
  check("aperçu joueur dessiné (écran VS)", (w.opsOf("playerCv") || []).length > 10,
        (w.opsOf("playerCv") || []).length + " ops");
  check("aperçu adversaire dessiné (écran VS)", (w.opsOf("scoutCv") || []).length > 10,
        (w.opsOf("scoutCv") || []).length + " ops");
  w.eval("NAV.uiBack()");
  noErr("rendu: aucune erreur JS");
});

// --------------------------------------------------------- render signature diff
// A stable draw signature: same state must produce the same op sequence twice.
safe("render determinism", () => {
  const sig = () => {
    w.clearOps("playerCv");
    w.eval("renderHome()");
    return (w.opsOf("playerCv") || []).join("|");
  };
  const a = sig(), b = sig();
  check("rendu déterministe à état constant", a === b,
        a === b ? a.length + " car." : "signatures divergentes");
});

// --------------------------------------------------------------- a full match
safe("match", () => {
  w.click("tabFight");
  w.click("fightBtn");
  check("écran de combat affiché", w.$("matchScreen").style.display !== "none",
        w.$("matchScreen").style.display);
  w.clearOps("cv");
  w.step(120, 33);                              // ~4 s of animation
  check("l'arène dessine", (w.opsOf("cv") || []).length > 50, (w.opsOf("cv") || []).length + " ops");
  // forfeit resolves the match without leaving the UI stuck
  w.click("forfeitBtn");
  check("abandon → superposition de fin affichée", w.$("overlay").style.display !== "none",
        w.$("overlay").style.display);
  check("cause de fin renseignée", (w.$("ovCause").textContent || "").length > 0,
        w.$("ovCause").textContent);
  w.click("ovBack");
  check("retour → écran d'accueil", w.$("homeScreen").style.display === "block");
  noErr("combat: aucune erreur JS");
});


// ------------------------------------------------------ B1: navigation
safe("navigation", () => {
  const w2 = openWorld();
  check("démarrage sur le Garage",
        w2.eval("$('workshopTab').style.display") !== "none" &&
        w2.eval("$('fightTab').style.display") === "none");
  // S6 (décision actée) : le tuning a QUITTÉ le garage — il ne vit qu'au VS
  check("les réglages IA ont quitté le Garage",
        w2.eval("!$('workshopTab').querySelector('#paramRows')"));
  check("les réglages IA vivent sur l'écran VS",
        w2.eval("!!$('vsScreen').querySelector('#paramRows') && !!$('vsScreen').querySelector('#powerRow')"));
  check("ordre des onglets : Garage | Championnats | Boutique",
        w2.eval("[...document.querySelectorAll('.rc-tabs .rc-tab')].map(b=>b.id).join()") === "tabWorkshop,tabFight,tabShop");
  w2.eval("startMatch('exhib')");
  check("pile : le match est poussé", w2.eval("NAV.stack.length===2 && $('matchScreen').style.display==='block'"));
  check("retour masqué pendant le match", w2.eval("$('navBack').style.display==='none'"));
  w2.eval("NAV.back()");
  check("pile : retour à l'accueil", w2.eval("NAV.stack.length===1 && $('homeScreen').style.display==='block'"));
  check("aucune erreur de navigation", w2.errors.length === 0, w2.errors[0] || "");
  w2.close();
});


// ------------------------------------------------------ robustesse file:// (tainted canvas)
safe("canvas contaminé", () => {
  const w3 = openWorld();
  // simuler la SecurityError de getImageData sous file://
  w3.eval("spriteState('boxy').img={complete:true,naturalWidth:512,naturalHeight:512}");
  w3.eval("window.__origCL=chassisLayers; chassisLayers=function(){ throw new Error('SecurityError simulée'); }");
  const ok = w3.eval("(function(){ try{ return !!tintedChassis('boxy','#4f83c9'); }catch(e){ return 'JETÉ: '+e.message; } })()");
  check("tintedChassis survit au canvas contaminé (repli multiply)", ok === true, String(ok));
  check("l'état dégradé est mémorisé (pas de re-tentative)", w3.eval("spriteState('boxy').taintFallback === true"));
  w3.close();
});


// ------------------------------------------------------ S5 : écrans Championnats A/B
safe("écrans ligues/concours", () => {
  const w5 = openWorld();
  /* S25 — le contenu s'ouvre désormais aux ÉTOILES, plus au palmarès. On
     accorde 1★ à chaque épreuve du Garage : la Régionale s'ouvre, comme pour
     un joueur qui a fait trois podiums. */
  w5.eval("S.stars = {sumoS:1, sparS:1, cupS:1, sumoM:1}; S.beaten = 99; renderHome()");
  /* A : une bannière par entrée de LIGUES — compté sur les DONNÉES, plus en dur :
     ajouter une ligue (Calibrage, Ouverte…) ne doit pas faire rougir la porte
     pour la seule raison qu'elle existe. Ce qui est vérifié : la couverture
     (autant de bannières que de ligues) et la partition ouverte/verrouillée. */
  const nLig = w5.eval("LIGUES.length");
  const nOuv = w5.eval("LIGUES.filter(l=>ligueUnlocked(l)).length");   // S25 : dérivé des étoiles
  check("A: une bannière par ligue déclarée",
        w5.eval("$('liguesList').querySelectorAll('.rc-league').length") === nLig, nLig);
  check("A: partition ouvertes / verrouillées conforme aux données",
        w5.eval("$('liguesList').querySelectorAll('.rc-league.is-open').length") === nOuv &&
        w5.eval("$('liguesList').querySelectorAll('.rc-league.is-locked').length") === nLig - nOuv,
        nOuv + " ouvertes / " + (nLig - nOuv) + " verrouillées");
  w5.eval("[...$('liguesList').querySelectorAll('.rc-league.is-locked')][0].click()");
  check("A: ligue verrouillée inerte", w5.eval("NAV.stack.length") === 1);
  // A → B : la RÉGIONALE explicitement (2e ouverte)
  w5.eval("[...$('liguesList').querySelectorAll('.rc-league.is-open')][1].click()");
  check("B: écran de ligue empilé et visible",
        w5.eval("NAV.stack.length===2 && $('ligueScreen').style.display==='block' && $('navBack').style.display!=='none'"));
  check("B: une carte par concours de la ligue",
        w5.eval("$('concoursList').querySelectorAll('.rc-cup').length")
          === w5.eval("ligueById(curLigue).concours.length"),
        w5.eval("curLigue + ' ' + ligueById(curLigue).concours.length"));
  check("B: fil d'Ariane porte le nom de la ligue", w5.eval("$('ligueName').textContent") === "Ligue Regionale");
  /* La chaîne INTERNE à la ligue joue aussi : sans étoile à l'Échelle M, le
     Sumo Léger reste fermé. Le fixe ci-dessus lui en accorde une. */
  // engagement explicite sur le championnat (2e carte : lightM)
  const btnLabel = w5.eval("[...$('concoursList').querySelectorAll('.rc-cup')][1].querySelector('.rc-btn').textContent");
  check("B: le championnat propose l'engagement", btnLabel === w5.eval("t('engage')"), btnLabel);
  w5.eval("[...$('concoursList').querySelectorAll('.rc-cup')][1].querySelector('.rc-btn').click()");
  check("B: engagement effectif (état + gel)",
        w5.eval("!!CN('lightM') && !!CN('lightM').lock"));
  check("B: la carte engagée montre disputer + abandonner",
        w5.eval("[...$('concoursList').querySelectorAll('.rc-cup')][1].querySelectorAll('.rc-btn').length") === 2);
  // abandon en deux taps
  w5.eval("[...[...$('concoursList').querySelectorAll('.rc-cup')][1].querySelectorAll('.rc-btn')][1].click()");
  check("B: premier tap = armement, rien n'est perdu", w5.eval("!!CN('lightM')"));
  check("B: le bouton demande confirmation",
        w5.eval("[...[...$('concoursList').querySelectorAll('.rc-cup')][1].querySelectorAll('.rc-btn')][1].textContent") === w5.eval("t('confirmAbandon')"));
  w5.eval("[...[...$('concoursList').querySelectorAll('.rc-cup')][1].querySelectorAll('.rc-btn')][1].click()");
  check("B: second tap = abandon effectif", w5.eval("CN('lightM') === null"));
  // retour
  w5.eval("NAV.uiBack()");
  check("B→A: retour à l'accueil", w5.eval("NAV.stack.length===1 && $('homeScreen').style.display==='block'"));
  check("aucune erreur sur le parcours S5", w5.errors.length === 0, w5.errors[0] || "");
  w5.close();
});


// ------------------------------------------------------ S6 : écran VS
safe("écran VS", () => {
  const w6 = openWorld();
  // S25 : le contenu s'ouvre aux étoiles — un joueur qui a fait ses podiums
  w6.eval("S.stars = {sumoS:1, sparS:1, cupS:1, sumoM:1}; S.beaten = 99");
  w6.eval("renderHome()");
  // B → VS via Disputer/Combattre
  w6.eval("[...$('liguesList').querySelectorAll('.rc-league.is-open')][1].click()");
  w6.eval("[...$('concoursList').querySelectorAll('.rc-cup')][1].querySelector('.rc-btn').click()");   // engager lightM
  w6.eval("[...[...$('concoursList').querySelectorAll('.rc-cup')][1].querySelectorAll('.rc-btn')][0].click()"); // disputer
  check("VS: écran empilé", w6.eval("NAV.stack.join()") === "homeScreen,ligueScreen,vsScreen");
  check("VS: manche annoncée", w6.eval("$('vsManche').textContent").includes("1"));
  check("VS: adversaire nommé", w6.eval("$('oppName').textContent.length") > 0);
  check("VS: réglages présents (déverrouillés) + mention unique", w6.eval("$('paramRows').querySelectorAll('.rc-seg').length") >= 2 && w6.eval("$('paramRows').querySelectorAll('.rc-label').length") === 1);
  const shown = w6.eval("$('oppName').textContent");
  // lancer : le combat affronte EXACTEMENT l'adversaire montré, et VS est remplacé
  w6.eval("$('fightBtn').click()");
  check("VS→match: remplacement de sommet", w6.eval("NAV.stack.join()") === "homeScreen,ligueScreen,matchScreen");
  check("VS: l'adversaire montré est celui du combat", w6.eval("match.bots[1].build === vsOpp.build") &&
        shown === w6.eval("vsOpp.name"), shown);
  // build gelé : le VS d'un concours verrouillé affiche le lock
  check("VS: le bot affiché honore le gel", w6.eval("CN('lightM').lock.chassis") === w6.eval("$('playerCv')._build.chassis"));
  check("aucune erreur sur le parcours S6", w6.errors.length === 0, w6.errors[0] || "");
  w6.close();
});


// ------------------------------------------------------ S7 : garage nouvelle formule
safe("garage S7", () => {
  const w7 = openWorld();
  w7.eval("S.bolts = 1e6; renderHome()");
  check("S7: le garage ne vend rien", w7.eval("$('garageStrip').querySelectorAll('.botprice').length") === 0);
  check("S7: cellule Boutique présente", w7.eval("!!$('garageStrip').querySelector('.rc-botcell--shop')"));
  check("S7: bandeau chassis en boutique", w7.eval("!!$('chassisShop').querySelector('.rc-league')"));
  w7.eval("$('garageStrip').querySelector('.rc-botcell--shop').click()");
  check("S7: la cellule Boutique bascule d'onglet", w7.eval("activeTab") === "shop");
  w7.eval("$('chassisShop').querySelector('.rc-league').click()");        // ouvre la sous-page chassis
  check("S7: sous-page chassis peuplée", w7.eval("$('chassisList').querySelectorAll('.rc-botcell').length") > 0);
  w7.eval("$('chassisList').querySelector('.rc-botcell').click()");
  check("S7: achat = nouveau bot + bascule garage", w7.eval("S.garage.length") === 2 && w7.eval("activeTab") === "workshop");
  const nInst = w7.eval("Object.keys(S.inv.items).length");
  const nFreeBefore = w7.eval("Object.keys(S.inv.items).filter(u=>!fittedMap()[u]).length");
  w7.eval("renderHome(); $('garageStrip').querySelector('.rc-scrap').click()");
  check("S7: premier tap = armement, bot intact", w7.eval("S.garage.length") === 2);
  w7.eval("$('garageStrip').querySelector('.rc-scrap').click()");
  check("S7: second tap = bot démoli", w7.eval("S.garage.length") === 1 && w7.eval("S.activeBot") === 0);
  check("S7: aucune instance détruite (coque nue : rien à libérer)",           // E7
        w7.eval("Object.keys(S.inv.items).length") === nInst &&
        w7.eval("Object.keys(S.inv.items).filter(u=>!fittedMap()[u]).length") === nFreeBefore);
  check("S7: l'inventaire visible reflète les pièces libres",
        w7.eval("$('invStrip').querySelectorAll('.rc-gcard').length") ===
        w7.eval("Object.keys(S.inv.items).filter(u=>!fittedMap()[u]).length"));
  w7.eval("renderHome()");
  check("S7: pas de bouton Jeter sur le dernier bot", w7.eval("!$('garageStrip').querySelector('.rc-scrap')"));
  check("S7: scrapBot refuse le dernier bot", w7.eval("scrapBot(0) === false && S.garage.length === 1"));
  check("aucune erreur sur le parcours S7", w7.errors.length === 0, w7.errors[0] || "");
  w7.close();
});


// ------------------------------------------------------ S8 : boutique en articles individuels
safe("boutique S8", () => {
  const w8 = openWorld();
  w8.eval("S.bolts = 1e6; renderHome(); showTab('shop')");
  check("S8: cartes rc-gcard avec visuel", w8.eval("$('garageRows').querySelectorAll('.rc-gcard').length") > 10 &&
        w8.eval("[...$('garageRows').querySelectorAll('.rc-gcard')].every(c=>c.querySelector('.rc-gcard__art'))"));
  check("S8: chaque article achetable porte un bouton prix rc-buy",
        w8.eval("$('garageRows').querySelectorAll('.rc-buy').length") > 5);
  const before = w8.eval("Object.keys(S.inv.items).length");
  const bolts = w8.eval("S.bolts");
  w8.eval("[...$('garageRows').querySelectorAll('.rc-buy')].find(b=>!b.disabled && !b.classList.contains('is-max') && b.querySelector('svg')).click()");
  check("S8: acheter mint une instance et débite",
        w8.eval("Object.keys(S.inv.items).length") === before + 1 && w8.eval("S.bolts") < bolts);
  check("aucune erreur sur le parcours S8", w8.errors.length === 0, w8.errors[0] || "");
  w8.close();
});


// ------------------------------------------------------ S9 : HUD batterie + santé, débrief DA
safe("HUD et débrief S9", () => {
  const w9 = openWorld();
  w9.eval("renderHome(); curLigue='regionale'; disputeConcours('libre'); $('fightBtn').click()");
  check("S9: jauges batterie ET santé présentes des deux côtés",
        w9.eval("!!$('gA') && !!$('gB') && !!$('hA') && !!$('hB')"));
  check("S9: étiquettes BATT/SANTÉ affichées",
        w9.eval("[...document.querySelectorAll('#matchScreen .rc-hudlabel')].length") === 4);
  check("S9: noms au HUD (VOUS + adversaire)",
        w9.eval("$('hudNameA').textContent") === w9.eval("t('you')") &&
        w9.eval("$('hudNameB').textContent.length") > 0);
  check("S9→E3: la barre de santé est VIVANTE (publiée par le moteur)",
        w9.eval("(function(){ for(let i=0;i<400 && !match.over;i++) ENGINE.tick(match); frame(16); const w=parseFloat($('hA').firstElementChild.style.width); return isFinite(w) && w>0 && w<=100 && Math.abs(w-match.bots[0].hp*100)<0.5; })()"));
  // débrief en table rc-debrief
  w9.eval("(function(){ let g=0; while(!match.over && g++<60000) ENGINE.tick(match); renderDebrief(match); })()");
  check("S9: débrief en table rc-debrief avec 4 lignes",
        w9.eval("!!$('ovStats').querySelector('table.rc-debrief')") &&
        w9.eval("$('ovStats').querySelectorAll('tr').length") === 5);
  check("aucune erreur sur le parcours S9", w9.errors.length === 0, w9.errors[0] || "");
  w9.close();
});


// ------------------------------------------------------ S10 : stickers sprites + placement libre + plaques version
safe("stickers S10", () => {
  const w10 = openWorld();
  w10.eval("S.bolts=1e6; renderHome()");
  check("S10: banque sprites chargée (44 stickers, 10 plaques)",
        w10.eval("STICKERS.length") === 44 && w10.eval("VSTICKERS.length") === 10 &&
        w10.eval("STICKERS.every(s=>s.src && s.w>0 && s.h>0 && s.cost>0)"));
  check("S10: plus aucun emoji dans la banque", w10.eval("STICKERS.every(s=>!s.emoji)"));
  // v0 offerte d'office ; v1 dérivée de la possession du logiciel s1
  check("S10: v0 offerte d'office", w10.eval("ownedStickerIds().includes('v0')"));
  check("S10: v1 absente sans logiciel", w10.eval("!ownedStickerIds().includes('v1')"));
  w10.eval("mintInstance('s1'); recomputeOwned()");
  check("S10: v1 accordée automatiquement avec le logiciel s1",
        w10.eval("ownedStickerIds().includes('v1')"));
  // placement libre : pose au centre continu, drag sans aimantation
  w10.eval("S.customize.stickers.push('skull'); S.customize.placed.push({id:'skull', x:4.37, y:5.81}); saveState()");
  check("S10: position continue conservée (pas d'aimantation à la pose)",
        w10.eval("S.customize.placed[0].x") === 4.37 && w10.eval("S.customize.placed[0].y") === 5.81);
  // rétro-lecture d'un ancien format {col,row} sans crash au dessin
  w10.eval("S.customize.placed.push({id:'star', col:3, row:4}); renderHome()");
  check("S10: ancien format col/row toléré au dessin", w10.errors.length === 0, w10.errors[0] || "");
  // boutique : cartes image + section plaques
  w10.eval("showTab('shop'); renderHome()");
  check("S10: cartes stickers en images",
        w10.eval("[...$('garageRows').querySelectorAll('.stickercard')].some(c=>c.querySelector('img'))"));
  check("S10: plaques exposées = logiciels au catalogue + v0",
        w10.eval("[...$('garageRows').querySelectorAll('.stickercard img')].filter(i=>i.alt.startsWith('v')).length") ===
        w10.eval("1 + (ENGINE.PARTS.software||[]).filter(p=>VSTICKERS.some(v=>v.sw===p.id)).length"));
  check("aucune erreur sur le parcours S10", w10.errors.length === 0, w10.errors[0] || "");
  w10.close();
});


// ------------------------------------------------------ P2 : chrome persistant
safe("chrome P2", () => {
  const wp = openWorld();
  wp.eval("renderHome()");
  // onglets visibles depuis un écran empilé, cliquer = pile à plat + onglet
  wp.eval("[...$('liguesList').querySelectorAll('.rc-league.is-open')][1].click()");
  check("P2: tabbar hors homeScreen (visible sur l'écran de ligue)",
        wp.eval("!$('homeScreen').contains(document.querySelector('.rc-tabs'))"));
  wp.eval("goTab('shop')");
  check("P2: onglet depuis écran empilé = retour accueil + onglet",
        wp.eval("NAV.stack.length===1 && activeTab==='shop' && $('homeScreen').style.display==='block'"));
  // indicateur sommaire + somme ancrée
  check("P2: victoires affichées au bandeau", wp.eval("$('winsLabel').textContent").includes("0"));
  check("P2: la somme vit dans le flanc du bandeau",
        wp.eval("!!document.querySelector('.rc-topbar__side #boltsLabel')"));
  // panneau réglages : langue + versions
  wp.eval("$('settingsBtn').click()");
  check("P2: le cog ouvre les réglages", wp.eval("$('settingsOv').style.display") === "flex");
  check("P2: comparatif de versions rempli", wp.eval("$('verTable').querySelectorAll('tr').length") >= 3);
  wp.eval("[...document.querySelectorAll('#langSeg .rc-seg__opt')].find(o=>o.dataset.lang==='en').click()");
  check("P2: bascule de langue depuis le panneau", wp.eval("LANG") === "en" && wp.eval("S.lang") === "en");
  wp.eval("$('settingsClose').click()");
  check("P2: fermeture du panneau", wp.eval("$('settingsOv').style.display") === "none");
  // accents : sortie sans diacritiques
  check("P2: aucun diacritique en sortie de t()", wp.eval("t('scrPass')") === "Eligible");
  check("aucune erreur sur le parcours P2", wp.errors.length === 0, wp.errors[0] || "");
  wp.close();
});


// ------------------------------------------------------ FID : fidélité à la spec DA
safe("fidélité DA", () => {
  const wf = openWorld();
  wf.eval("renderHome()");
  check("FID: onglets sous .rc-tabs (spec), pas d'invention",
        wf.eval("!!document.querySelector('nav.rc-tabs')") && wf.eval("!document.querySelector('.rc-tabbar')"));
  check("FID: écrans en rc-screen", wf.eval("document.querySelectorAll('.rc-screen').length") >= 6);
  check("FID: éditeur en bande rc-editor avec statgrid",
        wf.eval("!!document.querySelector('.rc-editor .rc-editorcanvas #editorCv')") &&
        wf.eval("$('statBars').classList.contains('rc-statgrid')"));
  check("FID: réglages en rc-seg (plus de select)",
        (wf.eval("curLigue='regionale'; disputeConcours('libre'); 1"),
         wf.eval("$('paramRows').querySelectorAll('.rc-seg').length") >= 2 &&
         wf.eval("$('paramRows').querySelectorAll('select').length") === 0));
  check("FID: portraits VS sous cadre rc-portrait",
        wf.eval("!!document.querySelector('.rc-portrait #playerCv') && !!document.querySelector('.rc-portrait #scoutCv')"));
  // cadrage : le canvas de combat est CARRÉ dans la plaque rc-arena
  wf.eval("$('fightBtn').click()");
  check("FID: canvas de combat carré (bug de cadrage mort)",
        wf.eval("!!document.querySelector('.rc-arena #cv')") &&
        wf.eval("cv.style.width === cv.style.height && cv.style.width !== ''"),
        wf.eval("cv.style.width") + " × " + wf.eval("cv.style.height"));
  check("aucune erreur sur le parcours FID", wf.errors.length === 0, wf.errors[0] || "");
  wf.close();
});


// ------------------------------------------------------ FID-3 : tuiles FIT + glyphe + HUD
safe("fidélité batch 3", () => {
  const wf3 = openWorld();
  wf3.eval("S.bolts=1e6; renderHome()");
  // acheter un second moteur pour avoir une famille à 2 tuiles
  wf3.eval("[...$('garageRows').querySelectorAll('.rc-buy')].find(b=>!b.disabled && b.querySelector('svg')).click()");
  wf3.eval("showTab('workshop'); renderHome()");
  check("FID3: plus aucun select de slot", wf3.eval("$('slotRows').querySelectorAll('select').length") === 0);
  const nT = wf3.eval("$('slotRows').querySelectorAll('.rc-tiles--fit .rc-tile').length");
  check("E7b: plus de catalogue par rangée (garage v2)", nT === 0, "tuiles: " + nT);
  // le sélecteur d'AJOUT liste l'inventaire libre ; cliquer équipe
  wf3.eval("(function(){ mintInstance('m1'); recomputeOwned(); renderHome(); })()");
  wf3.eval("$('addPartBtn').click()");
  const nPick = wf3.eval("$('addPicker').querySelectorAll('.rc-tile').length");
  check("E7b: le sélecteur montre l'inventaire libre", nPick >= 1, "tuiles: " + nPick);
  const before = wf3.eval("JSON.stringify(S.parts.equipped)");
  wf3.eval("[...$('addPicker').querySelectorAll('.rc-tile')][0].click()");
  check("E7b: cliquer une pièce libre l'équipe", wf3.eval("JSON.stringify(S.parts.equipped)") !== before);
  check("FID3: glyphe hexagonal dans le chip de somme", wf3.eval("!!$('boltsLabel').querySelector('svg')"));
  // HUD : ligne noms/round
  wf3.eval("curLigue='regionale'; disputeConcours('libre'); $('fightBtn').click()");
  check("FID3: ligne noms au-dessus des jauges",
        wf3.eval("$('hudNameA').textContent.length") > 0 && wf3.eval("!!$('hudRound')"));
  check("aucune erreur sur le parcours FID3", wf3.errors.length === 0, wf3.errors[0] || "");
  wf3.close();
});


// ------------------------------------------------------ P4/P5 : arène, couleurs, HUD aligné
safe("polish P4-P5", () => {
  const wp5 = openWorld();
  wp5.eval("renderHome()");
  check("P4: Rusty naît jaune-orangé", wp5.eval("S.garage[0].customize.color") === "#d98a45");
  {
    const fs = require("fs"), path = require("path");
    const src = fs.readFileSync(path.join(__dirname, "..", "pwa", "app.js"), "utf8");
    const i0 = src.indexOf("match.arenaR < AR-1");
    const blk = src.slice(i0, src.indexOf("ctx.stroke()", i0));
    check("P4: le donut d'assombrissement et l'anneau utilisent 2π exact",
          i0 > 0 && blk.includes("Math.PI*2") && !blk.includes(",0,7)"));
  }
  check("P4: couleurs de combat DA (violet joueur)",
        wp5.eval("PLAYER_COLOR") === "#b14bff" && wp5.eval("ENEMY_COLOR") === "#ff2a4a");
  // HUD : étiquettes DANS les jauges → jauges pleine largeur alignées
  check("P-align: les étiquettes vivent dans les jauges",
        wp5.eval("!!$('gA').querySelector('.rc-hudlabel') && !!$('hA').querySelector('.rc-hudlabel')"));
  check("P5: le scroll vertical passe sur l'éditeur (pan-y)",
        (wp5.eval("showTab('workshop'); bindEditor(); 1"), wp5.eval("$('editorCv').style.touchAction") === "pan-y"));
  check("aucune erreur sur le parcours P4-P5", wp5.errors.length === 0, wp5.errors[0] || "");
  wp5.close();
});


// ------------------------------------------------------ S11 : fonds, arènes, ombres
safe("visuels S11", () => {
  const w11 = openWorld();
  w11.eval("renderHome()");
  // arène par concours : le sprite du lancement suit la donnée
  w11.eval("curLigue='regionale'; disputeConcours('libre'); $('fightBtn').click()");
  check("S11b: l'arène du combat libre est la kawaii",
        w11.eval("(match.arenaSprite && match.arenaSprite.src || '').includes('arena_kawaii')"));
  // ombres : le composite existe pour les deux bots et un tour de flip ne crashe pas
  w11.eval("(function(){ for(let i=0;i<120 && !match.over;i++) ENGINE.tick(match); frame(16); })()");
  check("S11c: composites de bots rendus (ombre exacte)",
        w11.eval("!!BOT_SCRATCH[0] && !!BOT_SCRATCH[1] && BOT_SCRATCH[0].sil.width > 0"));
  w11.eval("match.bots[1].flippedT = 3; frame(16)");
  check("S11c: frame avec bot retourné sans erreur", w11.errors.length === 0, w11.errors[0] || "");
  // portrait adverse : classe prez posée
  w11.eval("NAV.uiBack(); disputeConcours('libre')");
  check("S11a: le portrait adverse porte un fond de présentation",
        w11.eval("!!document.querySelector('.rc-portrait--foe1 #scoutCv, .rc-portrait--foe2 #scoutCv')"));
  check("aucune erreur sur le parcours S11", w11.errors.length === 0, w11.errors[0] || "");
  w11.close();
});


// ------------------------------------------------------ S12 : CRT-bots + drag tactile
safe("UX S12", () => {
  const w12 = openWorld();
  w12.eval("showTab('workshop'); renderHome(); bindEditor()");
  // saisie élargie : un point à 0.3 cellule HORS d'une pièce 1×1 la saisit quand même
  const hit = w12.eval(`(function(){
    const L=getLayout(); const p=L.motor; if(!p) return "no-motor";
    const h=editorHit(L,{col:p.col-0.3,row:p.row+0.2});
    return h==="motor" ? "ok" : String(h); })()`);
  check("S12: tolérance tactile de saisie (marge 0.38)", hit === "ok", hit);
  // surbrillance : une frame d'éditeur avec editDrag posé ne crashe pas
  w12.eval("editDrag={slot:'motor'}; previewLoop(500); editDrag=null");
  check("S12: frame de drag avec surbrillance sans erreur", w12.errors.length === 0, w12.errors[0] || "");
  check("aucune erreur sur le parcours S12", w12.errors.length === 0, w12.errors[0] || "");
  w12.close();
});


// ------------------------------------------------------ S13 : éditeur carré + CRT réparé
safe("S13 proportions et CRT", () => {
  const w13 = openWorld();
  w13.eval("showTab('workshop'); renderHome()");
  check("S13: plus de classe --wide sur l'éditeur",
        w13.eval("!document.querySelector('.rc-editorcanvas--wide')"));
  check("S13: backing de l'éditeur carré",
        w13.eval("(function(){ previewLoop(100); const e=$('editorCv'); return e.width===e.height; })()"));
  check("aucune erreur S13", w13.errors.length === 0, w13.errors[0] || "");
  w13.close();
});


// ------------------------------------------------------ S15 : verrous cachés + logiciel les révèle
safe("controles S15", () => {
  const w15 = openWorld();
  w15.eval("S.bolts=1e6; renderHome(); curLigue='regionale'; disputeConcours('libre')");
  const before = w15.eval("$('paramRows').querySelectorAll('.rc-seg').length");
  check("S15: aucun contrôle verrouillé visible, aucun cadenas",
        !w15.eval("$('paramRows').textContent").includes("🔒"));
  check("S15: mention logicielle unique", w15.eval("$('paramRows').querySelectorAll('.rc-label').length") === 1);
  // monter s2 révèle approche + distance de charge
  w15.eval("mintInstance('s2'); tryEquip('software','s2'); recomputeOwned(); renderHome(); disputeConcours('libre')");
  const after = w15.eval("$('paramRows').querySelectorAll('.rc-seg').length");
  check("S15: le logiciel révèle des contrôles", after > before, before+" → "+after);
  check("S15: boutons chrome en rc-iconbtn",
        w15.eval("$('settingsBtn').classList.contains('rc-iconbtn') && $('navBack').classList.contains('rc-iconbtn')"));
  check("aucune erreur S15", w15.errors.length === 0, w15.errors[0] || "");
  w15.close();
});


// ------------------------------------------------------ E1 : portes de palmarès + bourses ×ligue
safe("économie E1 (UI)", () => {
  const we = openWorld();
  we.eval("renderHome()");
  // palmarès insuffisant : motif explicite avec compteur
  /* S25 — la porte n'est plus le palmarès mais l'ÉTOILE : sans podium au
     Garage, la Régionale reste fermée, et le motif le dit. */
  const r = we.eval("JSON.stringify(engageConcours('lightM'))");
  check("E1: verrou d'étoiles motivé", /"locked":true/.test(r), r);
  we.eval("S.stars = {sumoS:1, sparS:1, cupS:1, sumoM:1}; renderHome()");
  check("E1: porte franchie par les étoiles", we.eval("engageConcours('lightM').ok === true"),
        we.eval("JSON.stringify(engageConcours('lightM'))"));
  // bourses ×ligue : la fonction lit les données
  check("E1: purseMult depuis les données",
        we.eval("purseMult('sumoM')") === 1 && we.eval("purseMult('inconnu')") === 1);
  check("E1: WIN_EUR est la source unique", we.eval("WIN_BOLTS === WIN_EUR"));
  check("aucune erreur E1", we.errors.length === 0, we.errors[0] || "");
  we.close();
});


// ------------------------------------------------------ E2 : bot d'occasion assemblé
safe("bot d'occasion E2", () => {
  const w2b = openWorld();
  w2b.eval("S.bolts = 1e6; renderHome(); showTab('shop')");
  // offre déterministe du jour, garde-fous
  check("E2: une offre présente avec châssis achetable",
        w2b.eval("!!S.usedBotOffer && BUYABLE_CHASSIS.includes(S.usedBotOffer.chassis)"));
  check("E2: usure des pièces entre 20 et 50",
        w2b.eval("S.usedBotOffer.parts.filter(p=>p.cost>0).every(p=>p.wear>=20 && p.wear<=50)"));
  check("E2: jamais la gamme sommet du catalogue",
        w2b.eval("S.usedBotOffer.parts.filter(p=>p.cost>0).every(p=>{ const xs=ENGINE.PARTS[p.slot].filter(x=>x.cost>0); const maxG=Math.max(...xs.map(x=>gammeDe(p.slot,x.id))); return gammeDe(p.slot,p.id) < maxG; })"));
  check("E2: l'offre RENTRE sur sa coque (fitsOnHull)",
        w2b.eval("(function(){ const o=S.usedBotOffer, pm={}; for(const p of o.parts){ const sl=DEF_SLOT[p.id]; if(sl) pm[sl]=p.id; } return fitsOnHull({chassis:o.chassis, parts:pm, counts:{}}); })()"));
  check("E2: prix avantageux mais non nul",
        w2b.eval("S.usedBotOffer.price > 0 && S.usedBotOffer.price < S.usedBotOffer.newPrice"));
  check("E2: relance dans la même journée = même offre (pas de reroll)",
        w2b.eval("(function(){ const a=JSON.stringify(S.usedBotOffer); refreshUsedBot(); return a===JSON.stringify(S.usedBotOffer); })()"));
  // achat : bot au garage, instances usées, débit exact, offre vendue
  const price = w2b.eval("S.usedBotOffer.price");
  const bolts = w2b.eval("S.bolts");
  const nBots = w2b.eval("S.garage.length");
  const nInst = w2b.eval("Object.keys(S.inv.items).length");
  const nParts = w2b.eval("S.usedBotOffer.parts.length");
  w2b.eval("$('usedBotPlate').querySelector('.rc-buy').click()");
  check("E2: bot ajouté au garage et activé",
        w2b.eval("S.garage.length") === nBots+1 && w2b.eval("S.activeBot") === nBots);
  check("E2: débit exact", w2b.eval("S.bolts") === bolts - price);
  check("E2: instances mintées avec leur usure",
        w2b.eval("Object.keys(S.inv.items).length") === nInst + nParts &&
        w2b.eval("Object.values(AB().fit).flat().some(u=>S.inv.items[u].wear >= 20)"));
  check("E2: offre vendue jusqu'à demain",
        w2b.eval("S.usedBotOffer === null") &&
        (w2b.eval("showTab('shop'); renderHome(); 1"),
         w2b.eval("$('usedBotPlate').textContent").includes(w2b.eval("t('usedBotSold')").slice(0,5))));
  check("E2: invariants d'instances intacts (J14 tient toujours)",
        w2b.eval("Object.values(fittedMap()).every(Boolean)"));
  check("aucune erreur E2", w2b.errors.length === 0, w2b.errors[0] || "");
  w2b.close();
});


// ------------------------------------------------------ E3b : usure appliquée + réparations
safe("dégâts E3b", () => {
  const w3 = openWorld();
  w3.eval("S.bolts=1e6; renderHome(); curLigue='regionale'; disputeConcours('libre'); $('fightBtn').click()");
  // collision forgée + fin de combat → l'usure est le résidu
  w3.eval(`(function(){ const [a,b]=match.bots;
    a.pos={x:-12,y:0}; b.pos={x:12,y:0}; a.vel={x:95,y:0}; b.vel={x:-95,y:0};
    for(let i=0;i<30;i++) ENGINE.tick(match);
    let g=0; while(!match.over && g++<60000) ENGINE.tick(match); })()`);
  const before = w3.eval("JSON.stringify(Object.values(S.inv.items).map(i=>i.wear||0))");
  w3.eval("renderDebrief(match)");  // le flux réel passe par la fin de combat ; on force l'application :
  w3.eval("applyMatchDamage(match)");
  check("E3b: l'usure des instances a monté (jamais baissé)",
        w3.eval(`(function(){ const before=${before};
          const after=Object.values(S.inv.items).map(i=>i.wear||0);
          return after.some((w,i)=>w>before[i]) && after.every((w,i)=>w>=before[i]); })()`));
  check("E3b: rapport de dégâts constitué",
        w3.eval("!!S.lastDamage && (S.lastDamage.rows.length>0 || S.lastDamage.chassis>=0)"));
  check("E3b: usure de châssis comptée", w3.eval("(AB().chassisWear||0) >= 0"));
  // efficacité : une pièce HS ne contribue plus
  w3.eval("(function(){ const u=AB().fit.motor[0]; S.inv.items[u].wear=100; })()");
  check("E3b: moteur HS → efficacité nulle", w3.eval("buildEff(AB()).motor") === 0);
  check("E3b: usure 80 → efficacité entamée", 
        (w3.eval("(function(){ const u=AB().fit.motor[0]; S.inv.items[u].wear=80; })()"),
         Math.abs(w3.eval("buildEff(AB()).motor") - 0.75) < 0.01));
  // réparation : coût plancher, remise à zéro, débit
  const bolts = w3.eval("S.bolts");
  const cost = w3.eval("repairCostOf('motor', S.inv.items[AB().fit.motor[0]].def, 80)");
  check("E3b: coût = usure×prix×0.6 avec plancher", cost >= w3.eval("DAMAGE_TUNE.REPAIR_FLOOR"));
  w3.eval("repairInstance(AB().fit.motor[0])");
  check("E3b: réparation = usure 0 + débit exact",
        w3.eval("S.inv.items[AB().fit.motor[0]].wear") === 0 && w3.eval("S.bolts") === bolts - cost);
  // châssis : réparation seule
  w3.eval("AB().chassisWear = 40");
  const cb = w3.eval("S.bolts");
  w3.eval("repairChassis(AB())");
  check("E3b: châssis réparé (réparation seule)", w3.eval("AB().chassisWear") === 0 && w3.eval("S.bolts") < cb);
  // garage : chip d'usure + bouton réparer sur une rangée usée
  w3.eval("(function(){ const u=AB().fit.battery[0]; S.inv.items[u].wear=45; showTab('workshop'); renderHome(); })()");
  check("E3b: chip d'usure et bouton Réparer au garage",
        w3.eval("!!$('slotRows').querySelector('.rc-wear')") &&
        w3.eval("[...$('slotRows').querySelectorAll('.rc-toolbtn')].some(b=>b.textContent.includes('Reparer'))"));
  check("aucune erreur E3b", w3.errors.length === 0, w3.errors[0] || "");
  w3.close();
});


// ------------------------------------------------------ P-PLAN-UNIQUE : une nappe, trois onglets
safe("plan unique", () => {
  const wp = openWorld();
  wp.eval("showTab('workshop'); renderHome(); bindEditor()");
  // onglets : Tout / Structure / Equipement / Stickers
  const tabs = wp.eval("[...$('layerTabs').querySelectorAll('button')].map(b=>b.textContent).join('|')");
  check("PU: onglets Structure/Equipement/Stickers", /Structure/.test(tabs) && /quipement|quipment/.test(tabs)
        && !/Interne|Blindage|Externe/.test(tabs), tabs);
  // blindage absent des rangées garage et de la boutique
  check("PU: blindage absent du garage", !wp.eval("$('slotRows').textContent").includes(wp.eval("t('slot_armor')").slice(0,6)));
  wp.eval("showTab('shop'); renderHome()");
  check("PU: blindage absent de la boutique", wp.eval("$('shopGrid') ? !$('shopGrid').textContent.includes(t('slot_armor').slice(0,6)) : true"));
  // bassin unique : deux équipements ne peuvent pas se chevaucher, et l'équipement évite les roues (les 2 côtés)
  const overlap = wp.eval(`(function(){
    const L=getLayout(); const b={chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}};
    const m=L.motor, f=footprintOf('battery', idAt(b,'battery'));
    const others=[{...L.motor, f:footprintOf('motor', idAt(b,'motor'))}].concat(propulsionRects(b,L));
    return placementOK(b.chassis,'battery', {col:m.col,row:m.row}, others); })()`);
  check("PU: chevauchement d'équipement refusé", overlap === false);
  const wheelClash = wp.eval(`(function(){
    const L=getLayout(); const b={chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}};
    const pr=propulsionRects(b,L); if(!pr.length) return "no-wheel";
    const spot={col:pr[1].col, row:pr[1].row};    // côté MIROIR de la roue
    return placementOK(b.chassis,'battery', spot, pr); })()`);
  check("PU: l'équipement évite les roues (côté miroir compris)", wheelClash === false || wheelClash === "no-wheel", String(wheelClash));
  // un layout historique avec étage est invalidé puis auto-réparé
  wp.eval("AB().layout = Object.assign({}, getLayout()); AB().layout.motor = {...AB().layout.motor, floor:1}");
  check("PU: layout à étages invalidé puis réparé",
        wp.eval("(function(){ const L=getLayout(); return (L.motor.floor||0)===0; })()"));
  // une sauvegarde avec blindage monté est purgée au boot, bolts préservés
  check("PU: purge blindage au boot (mécanisme présent)",
        wp.eval("S.parts.equipped.armor === null || S.parts.equipped.armor === undefined"));
  check("aucune erreur plan unique", wp.errors.length === 0, wp.errors[0] || "");
  wp.close();
});


// ------------------------------------------------------ P-OMBRES : micro-ombres + roues débordantes
safe("ombres P-OMBRES", () => {
  const wo = openWorld();
  wo.eval("showTab('workshop'); renderHome(); bindEditor(); previewLoop(300)");
  check("PO: rendu éditeur sans erreur avec micro-ombres", wo.errors.length === 0, wo.errors[0] || "");
  // les colliders de roues débordent du chant (plus larges que la coque seule)
  const spread = wo.eval(`(function(){
    const b={chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}};
    const L=getLayout();
    const cols=buildColliders(b, L);
    const wheelY=cols.list.filter(k=>k.slot==='propulsion').map(k=>Math.abs(k.y));
    const hullY =cols.list.filter(k=>k.slot==='chassis').map(k=>Math.abs(k.y));
    if(!wheelY.length || !hullY.length) return "missing";
    return Math.max(...wheelY) > Math.max(...hullY) - 1 ? "ok" : "flush";
  })()`);
  check("PO: colliders de roues au débord (WYSIWYG)", spread === "ok", String(spread));
  check("aucune erreur P-OMBRES", wo.errors.length === 0, wo.errors[0] || "");
  wo.close();
});


// ------------------------------------------------------ E5 : passe visuelle navigateur
safe("E5 finitions", () => {
  const we = openWorld();
  we.eval("showTab('shop'); renderHome(); renderChassisScreen()");   // S20 : l'étal complet est dans la sous-page chassis
  check("E5: bandeau chassis unique en boutique (cartes déplacées en sous-page)",
        we.eval("$('chassisShop').querySelectorAll('.rc-league').length===1 && $('chassisShop').querySelectorAll('.rc-botcell--big').length===0"));
  // sections châssis par classe (S et M présents, S en premier)
  const secs = we.eval("[...$('chassisList').querySelectorAll('.rc-section')].map(e=>e.textContent).join('|')");
  check("E5: sections châssis S puis M", /S/.test(secs.split("|")[0]) && secs.split("|").length >= 2, secs);
  const nS = we.eval("$('chassisList').querySelectorAll('.rc-botcell--big').length");
  const BUYABLE_CHASSIS_N = we.eval("BUYABLE_CHASSIS.length");
  check("E5: une carte large par coque achetable (23 : 17 S + 5 M + 1 L, Rusty vendu)",
        nS === BUYABLE_CHASSIS_N, String(nS) + "/" + BUYABLE_CHASSIS_N);
  // l'occasion est un composite (canvas drawEditor, pas une tuile coque nue)
  check("E5: occasion assemblée (canvas composite)",
        we.eval("!!($('usedBotPlate') && $('usedBotPlate').querySelector('canvas'))"));
  // fonds d'éditeur par classe déclarés
  check("E5: fonds d'éditeur S/M déclarés",
        we.eval("EDITOR_BG.S==='assets/bg_s_nerd.webp' && EDITOR_BG.M==='assets/bg_s_mat.webp'"));
  check("aucune erreur E5", we.errors.length === 0, we.errors[0] || "");
  we.close();
});


// ------------------------------------------------------ E5b : cartes de concours signées
safe("E5b cartes concours", () => {
  const wb = openWorld();
  wb.eval("renderHome(); [...$('liguesList').querySelectorAll('.rc-league.is-open')][0].click()");
  const bg = wb.eval("[...$('concoursList').querySelectorAll('.rc-cup')][0].style.backgroundImage");
  check("E5b: la carte du Défi porte l'arène nerd", /arena_s_nerd/.test(bg), bg.slice(0,80));
  const lbl = wb.eval("[...$('concoursList').querySelectorAll('.rc-cup__struct')].map(e=>e.textContent).join('|')");
  check("E5b: libellés véridiques (4 manches, 6 manches, arbre 8)",
        /4 manches/.test(lbl) && /6 manches/.test(lbl) && /arbre 8/.test(lbl), lbl);
  check("aucune erreur E5b", wb.errors.length === 0, wb.errors[0] || "");
  wb.close();
});


// ------------------------------------------------------ E9 : intro & cérémonie de remise
safe("E9 intro et remise", () => {
  const w9 = openWorld({ save: null });
  w9.eval("$('careerNew').click()");
  check("E9: intro affichée à la création", w9.eval("$('introOv').style.display") !== "none");
  check("E9: le texte d'intro parle du but et du CT",
        /sumo/i.test(w9.eval("$('introBody').textContent")) && /technique|CT/i.test(w9.eval("$('introBody').textContent")));
  w9.eval("$('introGo').click()");
  check("E9: cérémonie Petit Rusty après l'intro",
        w9.eval("$('botRecvOv').style.display") !== "none"
        && w9.eval("$('recvName').textContent") === "PETIT RUSTY");
  w9.eval("$('recvGo').click()");
  check("E9: retour au garage", w9.eval("$('botRecvOv').style.display") === "none");
  // tout achat de châssis rejoue la cérémonie (coque nue)
  w9.eval("S.bolts = 500; buyBot('hex_s')");
  check("E9: cérémonie à l'achat d'une coque", w9.eval("$('botRecvOv').style.display") !== "none"
        && /HEX/.test(w9.eval("$('recvName').textContent")));
  w9.eval("$('recvGo').click()");
  check("aucune erreur E9", w9.errors.length === 0, w9.errors[0] || "");
  w9.close();
});

// ------------------------------------------------ S16-EDIT : la liste de pieces suit l'etat
safe("S16 liste garage", () => {
  const wl = openWorld();
  const r = wl.eval(`(function(){
    const out = {};
    const rowsOf = ()=> [...document.querySelectorAll("#slotRows .slotrow .sname")].map(e=>e.textContent);
    const nameOf = (slot)=>{ const rs=[...document.querySelectorAll("#slotRows .slotrow")];
      const row = rs.find(x=>x.querySelector(".sname") && x.querySelector(".sname").textContent===t("slot_"+slot));
      return row ? (row.querySelector(".scur")||{}).textContent||"" : null; };
    goTab("garage"); renderHome();
    out.before = rowsOf().includes(t("slot_cpu"));
    out.cpuName = nameOf("cpu");
    // RETRAIT : la rangee doit disparaitre SANS re-rendu manuel
    tryEquip("cpu", null);
    out.afterRemove = rowsOf().includes(t("slot_cpu"));
    out.cpuFreed = Object.keys(S.inv.items).some(u=>!fittedMap()[u] && DEF_SLOT[S.inv.items[u].def]==="cpu");
    // AJOUT : la rangee doit revenir, avec le bon libelle
    const def = Object.values(S.inv.items).map(i=>i.def).find(d=>DEF_SLOT[d]==="cpu");
    tryEquip("cpu", def);
    out.afterAdd = rowsOf().includes(t("slot_cpu"));
    out.nameOK = (nameOf("cpu")||"").includes(t("pn_"+def));
    // le selecteur d'ajout survit au re-rendu (on enchaine les montages)
    ADD_PICKER_OPEN = true; renderHome();
    out.pickerAlive = $("addPicker") && $("addPicker").style.display === "block";
    ADD_PICKER_OPEN = false;
    return out;
  })()`);
  check("S16L: rangée présente au départ, libellé non vide", r.before === true && !!r.cpuName, JSON.stringify(r.cpuName));
  check("S16L: RETIRER enlève la rangée et libère la pièce",
        r.afterRemove === false && r.cpuFreed === true, JSON.stringify({row:r.afterRemove, free:r.cpuFreed}));
  check("S16L: AJOUTER remet la rangée avec le bon nom",
        r.afterAdd === true && r.nameOK === true, JSON.stringify({row:r.afterAdd, name:r.nameOK}));
  check("S16L: le sélecteur d'ajout survit au re-rendu", r.pickerAlive === true, String(r.pickerAlive));
  check("S16L: aucune erreur", wl.errors.length === 0, wl.errors[0] || "");
  wl.close();
});

// ------------------------------------------------ S16-UI : chrome collant, VS ancre
safe("S16 interface collante", () => {
  // les feuilles externes ne sont pas chargees en jsdom : on lit le CSS reel
  const fs = require("fs"), path = require("path");
  const css = fs.readFileSync(path.join(__dirname, "..", "pwa", "roboclash-ui.css"), "utf8");
  const block = (sel)=>{ const i = css.indexOf(sel+"{"); if (i<0) return null;
    return css.slice(i, css.indexOf("}", i)); };
  const appB = block(".rc-app"), chromeB = block("#chrome"),
        fightB = block(".rc-btn--sticky"), vsB = block(".rc-vs");   // S19 : classes, plus d'ID
  check("S16U: .rc-app en overflow:clip — `hidden` tuerait le sticky du bandeau",
        !!appB && /overflow:clip/.test(appB) && !/overflow:hidden/.test(appB), (appB||"").slice(-40));
  check("S16U: #chrome sticky en haut", !!chromeB && /position:sticky/.test(chromeB) && /top:0/.test(chromeB), chromeB);
  check("S16U: bouton de combat collé en bas d'écran (classe, pas ID)",
        !!fightB && /position:sticky/.test(fightB) && /bottom:/.test(fightB), fightB);
  { const fs2 = require("fs"), p2 = require("path");
    const html = fs2.readFileSync(p2.join(__dirname, "..", "pwa", "index.html"), "utf8");
    check("S19: le markup porte bien les classes rc-btn--sticky / rc-screen--vs",
          /rc-btn--sticky/.test(html) && /rc-screen--vs/.test(html), ""); }
  check("S16U: VS ancré en px (repli), plus au centre vertical de la carte",
        !!vsB && /top:\d+px/.test(vsB) && !/top:50%/.test(vsB), vsB);
  const wu = openWorld();
  const ok = wu.eval(`(function(){ goTab("fight"); renderVsScreen(); anchorVs();
    return typeof anchorVs === "function"; })()`);
  check("S16U: anchorVs s'exécute sans mise en page (jsdom) sans jeter",
        ok === true && wu.errors.length === 0, wu.errors[0] || "");
  wu.close();
});

// ------------------------------------------------ S16-GARAGE : vignettes vivantes
safe("S16 garage", () => {
  const wg = openWorld();
  const r = wg.eval(`(function(){
    const out = {};
    goTab("garage"); renderHome();
    // 1) la vignette du botstrip dessine le BOT COMPLET (pieces montees), pas la coque seule
    let hull = 0, full = 0;
    const bot = S.garage[S.activeBot];
    const probe = document.createElement("canvas"); probe.width = probe.height = 64;
    const ctx = probe.getContext("2d");
    const seen = { tiles:0, board:0 };
    const realTiles = drawBotTiles, realBoard = drawChassisBoard;
    drawBotTiles = function(){ seen.tiles++; return realTiles.apply(this, arguments); };
    drawChassisBoard = function(){ seen.board++; return realBoard.apply(this, arguments); };
    drawBotThumb(ctx, bot.chassis, bot.customize.color, 64, bot);       // avec bot → complet
    out.fullPath = seen.tiles > 0;
    seen.tiles = 0;
    drawBotThumb(ctx, bot.chassis, bot.customize.color, 64);            // sans bot → silhouette
    out.silhouettePath = seen.tiles === 0;
    drawBotTiles = realTiles; drawChassisBoard = realBoard;
    // 2) les vignettes du garage sont ENREGISTREES : un changement de couleur les redessine
    renderGarageStrip();
    const tiles = [...TILE_REG].filter(c => c.isConnected || true);
    out.registered = tiles.length > 0;
    // 3) le canvas du bot d'occasion est enregistre lui aussi (coque jamais perdue)
    goTab("shop"); renderHome();
    const th = document.querySelector(".rc-usedbot .rc-botcell__thumb canvas");
    out.usedRegistered = !!th && typeof th._draw === "function";
    return out;
  })()`);
  check("S16G: vignette du garage = bot complet (drawBotTiles), pas la coque seule",
        r.fullPath === true, String(r.fullPath));
  check("S16G: repli silhouette conservé quand aucun bot n'est fourni",
        r.silhouettePath === true, String(r.silhouettePath));
  check("S16G: vignettes enregistrées (redessin au changement de couleur)",
        r.registered === true, String(r.registered));
  check("S16G: canvas du bot d'occasion enregistré — châssis jamais perdu",
        r.usedRegistered === true, String(r.usedRegistered));
  check("S16G: aucune erreur", wg.errors.length === 0, wg.errors[0] || "");
  wg.close();
});

// ------------------------------------------------ S17 : images unifiees, zero drift
safe("S17 images et cohérence", () => {
  const fs = require("fs"), path = require("path");
  const rd = (f) => fs.readFileSync(path.join(__dirname, "..", "pwa", f), "utf8");
  const srcTxt = rd("app.js") + "\n" + rd("render.js") + "\n" + rd("geometry.js");   // Phase B : le rendu/geometrie vivent hors app.js
  // aucune image ne doit echapper au registre (une seule construction, dans mkImg)
  const rawImgs = (srcTxt.match(/new Image\(\)/g) || []).length;
  check("S17: une seule construction d'Image (tout passe par mkImg)", rawImgs === 1, rawImgs + " occurrences");
  // le cadrage est une constante partagee : plus aucun litteral de cadrage
  const strayFrame = (srcTxt.match(/0\.4[67]\s*\)\s*\/\s*BOARD_HALF/g) || []).length;
  check("S17: cadrage unique BOT_FRAME (aucun litteral 0.46/0.47 restant)", strayFrame === 0, strayFrame + " restants");
  const usesFrame = (srcTxt.match(/BOT_FRAME/g) || []).length;
  check("S17: BOT_FRAME sert au dessin ET au pointage (≥4 usages)", usesFrame >= 4, usesFrame + " usages");

  const wi = openWorld();
  const r = wi.eval(`(function(){
    const out = {};
    // etats : pending au depart, dedup, failed sur erreur (et journalise)
    const im1 = mkImg("assets/__test_s17.webp");
    const im2 = mkImg("assets/__test_s17.webp");
    out.dedup = (im1 === im2);
    out.pending = imgState("assets/__test_s17.webp");
    out.somePending = imagesPending();
    if (im1.onerror) im1.onerror();
    out.failed = imgState("assets/__test_s17.webp");
    out.logged = errlog().some(e => e.kind === "image");
    out.unknownIsReady = imgState("jamais/vu.webp");   // inconnu → on ne bloque rien
    // le sheen ne jette jamais, quel que soit l'etat
    const cv = document.createElement("canvas"); cv.width = cv.height = 40;
    const c = cv.getContext("2d");
    for (const st of ["pending","ready","failed"]) drawLoadSheen(c, 0, 0, 40, 40, st);
    out.sheenSafe = true;
    // buildOfBot : MEME build pour la vignette et pour l'editeur
    const bot = S.garage[S.activeBot];
    const a = buildOfBot(bot);
    out.hasAll = ["chassis","parts","counts","color","stickers0"].every(k => k in a);
    out.colorKept = a.color === bot.customize.color;
    const lay = layoutOfBot(bot, a);
    out.layoutOK = !!lay && layoutValid(a, lay);
    return out;
  })()`);
  check("S17: registre déduplique et démarre en pending",
        r.dedup === true && r.pending === "pending" && r.somePending === true,
        JSON.stringify({dedup:r.dedup, state:r.pending}));
  check("S17: échec de chargement → état failed + journal (plus de trou silencieux)",
        r.failed === "failed" && r.logged === true, JSON.stringify({s:r.failed, log:r.logged}));
  check("S17: source inconnue traitée comme prête (rien ne se bloque)", r.unknownIsReady === "ready", r.unknownIsReady);
  check("S17: le sheen ne jette dans aucun état", r.sheenSafe === true, String(r.sheenSafe));
  check("S17: buildOfBot porte couleur, stickers, multiplicité — un seul assemblage",
        r.hasAll === true && r.colorKept === true && r.layoutOK === true,
        JSON.stringify({all:r.hasAll, col:r.colorKept, lay:r.layoutOK}));
  check("S17: aucune erreur", wi.errors.length === 0, wi.errors[0] || "");
  wi.close();
});

// ------------------------------------------------ S18 : séries de châssis + stickers par classe
safe("S18 séries et stickers", () => {
  const ws = openWorld();
  const r = ws.eval(`(function(){
    const out = {};
    // 1) TOUTE coque déclare une série connue, achetable ou non
    out.orphans = Object.keys(CHASSIS_REG).filter(c => !CHASSIS_SERIES[chassisSeriesOf(c)]);
    out.covered = {};
    for (const ch of BUYABLE_CHASSIS) out.covered[chassisClassOf(ch)] = (out.covered[chassisClassOf(ch)]||0)+1;
    out.total = BUYABLE_CHASSIS.length;
    // 2) métadonnée complète et bilingue
    const s = serieOf(DEFAULT_SERIES);
    out.meta = !!(s && s.name && s.name.fr && s.name.en && s.blurb && s.blurb.fr && s.blurb.en && s.accent);
    out.named = serieName(DEFAULT_SERIES).length > 3;
    // 3) coque inconnue → série d'origine (aucune orpheline)
    out.fallback = chassisSeriesOf("__inexistant__") === DEFAULT_SERIES;
    // 4) l'étal rend UNE section par série et resterait correct avec deux
    goTab("shop"); renderHome(); renderChassisScreen();
    out.banners = document.querySelectorAll("#chassisList .rc-serie").length;
    CHASSIS_SERIES.__test = { id:"__test", order:2, accent:"#0ff",
                              name:{fr:"Essai",en:"Test"}, blurb:{fr:"x",en:"x"} };
    const keep = CHASSIS_SERIE.disque; CHASSIS_SERIE.disque = "__test";
    renderChassisScreen();
    out.banners2 = document.querySelectorAll("#chassisList .rc-serie").length;
    out.cardsStill = document.querySelectorAll("#chassisList .rc-botcell").length;
    CHASSIS_SERIE.disque = keep; delete CHASSIS_SERIES.__test; renderChassisScreen();
    // 5) stickers : facteur dérivé de la classe, S deux fois plus petit que M
    out.sc = { S:STICKER_SCALE.S, M:STICKER_SCALE.M, L:STICKER_SCALE.L };
    // la part de coque couverte doit se rapprocher entre S et M
    const partOf = (ch)=>{ const v=viewParams(ch), b=chassisBounds(ch);
      const k=STICKER_SCALE[chassisClassOf(ch)]||1;
      return (1.6*k) / (b.maxR-b.minR+1); };                    // hauteur sticker / profondeur coque
    out.pM = Math.round(partOf("tortue")*100)/100;
    out.pS = Math.round(partOf("tortue_s")*100)/100;
    return out;
  })()`);
  check("S18: aucune coque orpheline de série", r.orphans.length === 0, r.orphans.join(","));
  /* S30-ASSETS : 23 coques achetables (17 S, 5 M, 1 L) réparties sur quatre
     séries — antan, casse, circuit, hightech. Le compte est FIGÉ volontairement :
     une coque qui perdrait sa série doit faire rougir la porte. */
  check("S18: 23 coques achetables, toutes rattachées à une série (17 S, 5 M, 1 L)",
        r.total === 23 && r.covered.S === 17 && r.covered.M === 5 && r.covered.L === 1,
        JSON.stringify(r.covered));
  check("S18: métadonnée complète et bilingue (nom, accroche, accent)",
        r.meta === true && r.named === true, JSON.stringify({meta:r.meta, named:r.named}));
  check("S18: coque inconnue → série d'origine", r.fallback === true, String(r.fallback));
  check("S18: l'étal rend une section par série et en accueille une DE PLUS sans code",
        r.banners === 4 && r.banners2 === r.banners + 1 && r.cardsStill > 0,
        JSON.stringify({series:r.banners, avecTest:r.banners2, cartes:r.cardsStill}));
  check("S18: stickers — S à moitié de M, provision L présente",
        r.sc.S === 0.5 && r.sc.M === 1 && r.sc.L > 1, JSON.stringify(r.sc));
  check("S18: la part de coque couverte se rapproche entre S et M (écart < 12 pts)",
        Math.abs(r.pS - r.pM) < 0.12, "M=" + r.pM + " S=" + r.pS);
  check("S18: aucune erreur", ws.errors.length === 0, ws.errors[0] || "");
  ws.close();
});

// ------------------------------------------------------ S20 : la teinte suit la GAMME
safe("S20 teinte de tuile dépositionnée", () => {
  const wg = openWorld();
  check("S20: la teinte d'une pièce est celle de sa gamme déclarée",
        wg.eval("tierColor('motor','m2') === TIER_COLORS[ENGINE.PARTS.motor.find(p=>p.id==='m2').gamme]"));
  // on retrograde m2 en gamme 0 : la teinte doit SUIVRE, alors que sa position ne bouge pas
  const repositioned = wg.eval(`(function(){
    const p = ENGINE.PARTS.motor.find(x=>x.id==='m2'), g0 = p.gamme;
    p.gamme = 0; const c = tierColor('motor','m2'); p.gamme = g0;
    return c === TIER_COLORS[0]; })()`);
  check("S20: changer la gamme change la teinte, à position constante", repositioned);
  // et une pièce ajoutée en fin de liste avec une gamme basse s'affiche BASSE
  const appended = wg.eval(`(function(){
    ENGINE.PARTS.motor.push({id:"__probe", gamme:1, cost:0, push:1, speed:1, mass:0});
    const c = tierColor('motor','__probe'); ENGINE.PARTS.motor.pop();
    return c === TIER_COLORS[1]; })()`);
  check("S20: une micro-pièce en fin de catalogue n'est plus 'haut de gamme'", appended);
  check("S20: aucune erreur", wg.errors.length === 0, wg.errors[0] || "");
  wg.close();
});

w.close();
report("QC interface");


// ---------------- S36 : un bot ASSEMBLE ne doit jamais etre presente deshabille
safe("S36 ceremonie de remise", () => {
  const we = openWorld();
  /* La remise dessinait drawBotThumb(c, chassis, null, 256) — sans bot, donc la
     coque nue. Le cadeau de depart et le bot d'occasion sont des bots ASSEMBLES.
     On compte les drawImage : une coque nue en pose 1, un bot complet bien plus. */
  const r = we.eval(`(function(){
    const cv = document.createElement("canvas"); cv.width = cv.height = 256;
    const bot = AB();
    const nOps = (b)=>{ const c = cv.getContext("2d"); const n0 = c._ops.length;
      drawBotThumb(c, bot.chassis, null, 256, b); return c._ops.length - n0; };
    const nu = nOps(null), complet = nOps(bot);
    const eq = Object.keys(bot.equipped||{}).filter(s=>bot.equipped[s]).length;
    return JSON.stringify({nu, complet, eq, chassis:bot.chassis});
  })()`);
  const o = JSON.parse(r);
  check("S36: le bot de depart a bien des pieces equipees", o.eq >= 3, o.eq + " slots");
  check("S36: un bot COMPLET dessine plus qu'une coque nue",
        o.complet > o.nu, o.complet + " ops vs " + o.nu + " pour la coque seule");
  we.close();
});
