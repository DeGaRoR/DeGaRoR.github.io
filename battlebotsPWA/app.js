/* app.js — couche application : état, éditeur, tournois, rendu, UI.
   Dépend de data.js (STRINGS, sprites, TIERS) et de engine.js (ENGINE). */
/* ============================================================
   ENGINE (pure, deterministic, no DOM) — extractable for tests
   ============================================================ */


/* ============================================================
   I18N
   ============================================================ */

let LANG = "fr";
/* Décision playtest 22/07 : PAS d'accents à l'écran, même en français —
   les fontes display (Orbitron/Press Start/Saira caps) les rendent mal.
   Suppression uniforme des diacritiques à la sortie ; les STRINGS gardent
   leurs accents en source (réversible en retirant da()). */
/* da \u2014 historiquement un \u00ab diacritic-stripper \u00bb global (les accents \u00e9taient retir\u00e9s
   par crainte de polices sans glyphes accentu\u00e9s). Les polices (ou leur repli
   'Barlow/Saira Condensed') rendent les accents correctement : on NEUTRALISE le
   strip pour du vrai fran\u00e7ais. Fonction conserv\u00e9e (\u224821 appelants) \u2192 identit\u00e9. */
const da = (s) => s;
const t = (k, vars) => {
  let s = (STRINGS[LANG][k] ?? STRINGS.en[k] ?? k);
  if (vars) for (const [kk,vv] of Object.entries(vars)) s = s.split("{"+kk+"}").join(vv);
  return da(s);
};

const OPP_NAMES = ["GRIZZLI","TRANCHE","RIVET","PIKPIK","MAMMOUTH","VORTEX","CAFARD",
  "TAUPE","FURIE","CROC","PATATE","BOULON"];

/* ============================================================
   STATE (localStorage, guarded)
   ============================================================ */
const SKEY = "roboclash_s4";
/* S2 — PIÈCES EN INSTANCES (SAVE_V=4).
   Source de vérité : S.inv (instances individuelles) + bot.fit (uid par slot).
   bot.equipped / bot.counts sont des CACHES dérivés, régénérés par refit()
   après chaque mutation — ne JAMAIS y écrire directement. Le moteur, le
   layout, l'homologation et bk.lock consomment ces caches, inchangés.
   Migration v4→v5→v6 (migrate) : les anciennes sauvegardes sont ADAPTÉES, jamais
   perdues (l'état brut est sauvegardé avant transformation). Une version inconnue
   déclenche un reset EXPLICITE (SAVE_RESET_NOTICE). */
const SAVE_V = 6;   // v6 : identité stable botId (Phase 2). Chaîne de migration v4→v5→v6 (migrate()).
let SAVE_RESET_NOTICE = false;   // un état existant mais inadoptable a-t-il dû être réinitialisé ?
// a chassis is valid only if the engine knows it; unknown → fall back rather than crash.
function validChassis(ch){ return (ch && ENGINE.PHYS.chassis[ch] && ENGINE.CHASSIS[ch]) ? ch : "boxy"; }
const DEF_SLOT = {};                        // def -> slot d'appartenance (catalogue)
for (const sl in ENGINE.PARTS) for (const p of ENGINE.PARTS[sl]) DEF_SLOT[p.id] = sl;
const BASE_KIT = { propulsion:"pr0", motor:"m0", cpu:"c0", battery:"b0", sensors:"n0" }; // kit de tout châssis neuf
const BOLT_SVG = '<svg width="11" height="11" viewBox="0 0 12 12" style="vertical-align:-1px"><polygon points="6,1 10.5,3.5 10.5,8.5 6,11 1.5,8.5 1.5,3.5" fill="currentColor"/></svg>';
function mintInto(inv, def, extra){ const uid = "i"+(++inv.seq);
  inv.items[uid] = Object.assign({ def, wear:0 }, extra||{}); return uid; }
/* P-PILOTE — le pilote appartient au BOT, pas à la carrière. Les sept réglages
   de conduite vivaient dans S.settings, global : deux bots du garage
   partageaient une seule agressivité, et le palier logiciel se lisait sur les
   pièces POSSÉDÉES. Le pilote entraîné (T) sera attaché au châssis : c'est
   cette structure qui le portera. Clés DÉRIVÉES d'ENGINE.OPTS, jamais listées. */
const PILOT_KEYS = Object.keys(ENGINE.OPTS);
const PILOT_DEF = (()=>{ const d={}; for (const k of PILOT_KEYS) d[k] = ENGINE.SLICE1.playerBuild[k]; return d; })();
function validPilot(p){                     // durcissement : toute valeur inconnue retombe au défaut
  const out = {...PILOT_DEF};
  if (p && typeof p === "object")
    for (const k of PILOT_KEYS) if (ENGINE.OPTS[k].indexOf(p[k]) >= 0) out[k] = p[k];
  return out; }
function bareBot(chassis){
  return { chassis: validChassis(chassis), fit:{}, pilot:{...PILOT_DEF},
    customize:{ color:"#d98a45", stickers:[], placed:[] }, layout:null,   // jaune-orangé d'usine (= DEFAULT_CHASSIS_COLOR, littéral : TDZ)
    equipped:{}, counts:{} }; }             // caches (voir refit)
function newBotInto(inv, chassis){
  const b = bareBot(chassis);
  for (const sl in BASE_KIT) b.fit[sl] = [ mintInto(inv, BASE_KIT[sl]) ];
  return b; }
/* Phase 2 — identité stable : chaque bot porte un botId ("B"+n), indépendant de sa
   position dans S.garage. Le verrou de concours, l'usure et les dégâts se lient à
   CET id, plus à S.activeBot (qui peut changer entre l'engagement et le match). */
function assignBotId(bot){
  if (!bot.botId){ S.botSeq = (S.botSeq || 0) + 1; bot.botId = "B" + S.botSeq; }
  return bot.botId; }
function botById(id){ return (S.garage || []).find(b => b && b.botId === id) || null; }
function defaultState(){
  const inv = { seq:0, items:{} };
  const bot = newBotInto(inv, "boxy");
  bot.botId = "B1";                        // Phase 2 : identité stable, indépendante de l'index garage
  return {
    v: SAVE_V,
    lang:"fr", beaten:0, speed:1,           // beaten = qualifier+friendly wins (param unlocks)
    level:1, beatenAtLevel:0,               // 2 qualifier wins open the tournament
    bolts:0,
    inv, garage:[bot], activeBot:0, botSeq:1,
    badges:[], champion:false,
    tourney:null,                           // {idx, opponents:[{name,archetype,build,level}x3]}
    concours:{},                            // progression par concours engagé (id → état de format, + lock éventuel)
    concoursDone:{},                        // concours menés à leur terme (unlock déclaratif)
    stars:{},                               // S25 : { concoursId: 0..3 }, MEILLEUR résultat conservé
    opponent:null,                          // current qualifier {name, archetype, build, level}
  };
}
/* validState — valide un état au SAVE_V courant (la migration est faite en amont).
   Vérifie : version, structure inv, uid référencés existants, jamais double-
   référencés, du bon slot, mono-def par slot, seq cohérent. */
function validState(st){
  try{
    if (!st || st.v !== SAVE_V) return false;
    if (!st.inv || typeof st.inv.seq !== "number" || !st.inv.items) return false;
    if (!Array.isArray(st.garage) || !st.garage.length) return false;
    for (const uid in st.inv.items){
      const n = parseInt(String(uid).slice(1), 10);
      if (!(n >= 1 && n <= st.inv.seq)) return false;
      if (!DEF_SLOT[st.inv.items[uid].def]) return false; }
    const seen = {};
    for (const b of st.garage){
      if (!b || typeof b !== "object" || !b.fit) return false;
      for (const sl in b.fit){
        if (!Array.isArray(b.fit[sl])) return false;
        let d0 = null;
        for (const uid of b.fit[sl]){
          const it = st.inv.items[uid];
          if (!it || seen[uid] || DEF_SLOT[it.def] !== sl) return false;
          if (d0 && it.def !== d0) return false;       // mono-def par slot
          d0 = it.def; seen[uid] = 1; } } }
    return true;
  } catch(e){ return false; }
}
/* Phase 3 — MIGRATION (remplace l'ancienne politique « rejeter tout autre schéma »).
   Chaîne v4→v5→v6, non destructive : l'état brut est SAUVEGARDÉ avant transformation
   (roboclash_s4_bak_vN). Une version inconnue (trop vieille/future) renvoie null →
   reset EXPLICITE (SAVE_RESET_NOTICE), jamais un effacement silencieux. */
function migrate(raw){
  if (!raw || typeof raw !== "object") return null;
  let st = raw, v = st.v | 0;
  if (v === SAVE_V) return st;
  try { localStorage.setItem(SKEY + "_bak_v" + v, JSON.stringify(raw)); } catch(_){}
  if (v === 4){                                    // v4→v5 : le pilote GLOBAL (S.settings) devient celui de CHAQUE bot
    const g = (st.settings && typeof st.settings === "object") ? st.settings : null;
    if (Array.isArray(st.garage)) for (const b of st.garage) if (b && !b.pilot && g) b.pilot = {...g};
    delete st.settings; v = st.v = 5;
  }
  if (v === 5){ v = st.v = 6; }                    // v5→v6 : identité stable ; botId backfillé par bootSanitize
  return st.v === SAVE_V ? st : null;
}
function adoptSave(cand){                           // migre puis valide ; renvoie true si l'état est adopté
  const st = migrate(cand);
  if (st && validState(st)){ S = {...defaultState(), ...st}; return true; }
  if (cand) SAVE_RESET_NOTICE = true;               // un état EXISTAIT mais est inadoptable : on le SIGNALE
  return false;
}

// stackable internal slots (L3.5 multiplicity) — donnée UI : quels slots offrent ±
const STACK_SLOTS = { motor:1, battery:1, cooling:1, ballast:1 };
/* A3 — slots optionnels. La pièce d'indice 0 d'un slot à masse 0 ET coût 0 n'est
   pas un objet : c'est l'ABSENCE. L'état stocke null pour ces slots ; le moteur
   garde son descripteur zéro (partOf(slot,null) le résout). Dérivé des données :
   armor, weapon1, weapon2, software, ballast, srimech, cooling. */
const EMPTY_ID = {}, OPTIONAL_SLOTS = {};
for (const sl of Object.keys(ENGINE.PARTS)){ const p0 = ENGINE.PARTS[sl][0];
  if (p0.cost === 0 && ENGINE.partMassKg(sl, p0.id) === 0){ OPTIONAL_SLOTS[sl] = true; EMPTY_ID[sl] = p0.id; } }
const normEquip = (slot, id) => (OPTIONAL_SLOTS[slot] && id === EMPTY_ID[slot]) ? null : id;
// ---- L1 Garage & Inventory: un bot = châssis + fit (uid par slot) ; les pièces vivent dans S.inv ----
function AB(){ return S.garage[S.activeBot]; }                       // active bot
function PILOT(){ return AB().pilot; }                               // P-PILOTE : réglages de conduite du bot actif
function syncActive(){ const b=AB(); S.parts=S.parts||{}; S.parts.equipped=b.equipped; S.customize=b.customize; } // live pointers (caches)
/* refit — régénère les caches type-niveau (equipped/counts) depuis fit. */
function refit(bot, inv){ inv = inv || S.inv;
  bot.fit = bot.fit || {};
  bot.equipped = {}; bot.counts = {};
  for (const sl in ENGINE.PARTS){
    const arr = bot.fit[sl] || (bot.fit[sl] = []);
    bot.equipped[sl] = arr.length ? ((inv.items[arr[0]]||{}).def || null) : null;
    if (arr.length > 1) bot.counts[sl] = arr.length; } }
function fittedMap(){ const m={}; S.garage.forEach((b,bi)=>{
  for(const sl in (b.fit||{})) for(const uid of b.fit[sl]) m[uid]={bot:bi, slot:sl}; }); return m; }
function mintInstance(def, extra){ return mintInto(S.inv, def, extra); }
function invCount(def){ let n=0; for(const u in S.inv.items) if(S.inv.items[u].def===def) n++; return n; } // total instances possédées
function installedElsewhere(def){ let n=0; S.garage.forEach((b,i)=>{ if(i===S.activeBot) return;
  for(const sl in (b.fit||{})) for(const uid of b.fit[sl]) if((S.inv.items[uid]||{}).def===def) n++; }); return n; }
function availFor(def){ return invCount(def) - installedElsewhere(def); } // copies hors autres bots
function freeUids(def){ const fm = fittedMap();                       // instances libres, moins usée d'abord
  return Object.keys(S.inv.items)
    .filter(u => S.inv.items[u].def===def && !fm[u])
    .sort((a,b) => (S.inv.items[a].wear||0) - (S.inv.items[b].wear||0)); }
function recomputeOwned(){ // rebuild S.parts.owned for the active bot: a part shows if a copy is free (or it's already equipped here)
  const owned={}, eq=AB().equipped;
  for(const slot in eq){ owned[slot]=[];
    for(const p of (ENGINE.PARTS[slot]||[])){ const id=p.id;
      if((OPTIONAL_SLOTS[slot] && id===EMPTY_ID[slot])            // « vide » : toujours proposé, jamais possédé
         || (invCount(id)>0 && (availFor(id)>=1 || eq[slot]===id))) owned[slot].push(id); }
    if(!owned[slot].length) owned[slot]=[eq[slot]]; }
  S.parts.owned=owned; }

/* ══ CARRIÈRES (E6) — trois slots indépendants + pointeur actif.
   roboclash_career_<n> porte un état complet ; roboclash_active désigne le
   slot chargé. L'ancienne clé roboclash_s4 est ADOPTÉE en Carrière 1 au
   premier boot (déplacement de clé, pas une migration de schéma). ══ */
const CAREER_MAX = 3;
const careerKey = (n) => "roboclash_career_" + n;
function activeCareer(){ const n = parseInt(localStorage.getItem("roboclash_active"), 10);
  return (n >= 1 && n <= CAREER_MAX) ? n : null; }
function careersList(){
  const out = [];
  for (let n = 1; n <= CAREER_MAX; n++){
    try { const raw = localStorage.getItem(careerKey(n)); if (!raw) continue;
      const c = JSON.parse(raw);
      out.push({ n, name: c.careerName || ("Carri\u00E8re " + n), bolts: c.bolts|0,
                 level: c.level|0, beaten: c.beaten|0,
                 chassis: (c.garage && c.garage[c.activeBot||0] || {}).chassis || "boxy",
                 bot: (c.garage && c.garage[c.activeBot||0]) || null,        // S16-GARAGE : vignette complète
                 color: ((c.garage && c.garage[c.activeBot||0] || {}).customize||{}).color || null });
    } catch(e){} }
  return out;
}
(function adoptLegacy(){
  try {
    const legacy = localStorage.getItem(SKEY);
    if (legacy && !localStorage.getItem(careerKey(1))){
      localStorage.setItem(careerKey(1), legacy);
      localStorage.removeItem(SKEY);
      if (!activeCareer()) localStorage.setItem("roboclash_active", "1");
    }
  } catch(e){}
})();

let S = defaultState();
let CUR_CAREER = activeCareer();
try {
  if (CUR_CAREER){
    const raw = localStorage.getItem(careerKey(CUR_CAREER));
    if (raw){
      adoptSave(JSON.parse(raw));                 // Phase 3 : migre (v4→v5→v6) puis valide ; sinon reset SIGNALÉ
      /* adoptSave : migré puis validé ; version inconnue → reset explicite. */
    }
  }
} catch(e){}
function bootSanitize(){
  S.garage.forEach(b => refit(b));
  /* Phase 2 — backfill des identités : le compteur dépasse le max existant, puis
     tout bot sans id en reçoit un (états legacy, carrières adoptées). */
  S.botSeq = S.botSeq || 0;
  for (const b of S.garage){ const n = b.botId ? (parseInt(String(b.botId).slice(1), 10) || 0) : 0; if (n > S.botSeq) S.botSeq = n; }
  S.garage.forEach(b => assignBotId(b));
  if (S.activeBot==null || S.activeBot>=S.garage.length) S.activeBot=0;
  S.garage.forEach(b=>{ b.chassis = validChassis(b.chassis); b.pilot = validPilot(b.pilot); });
  delete S.settings;                        // P-PILOTE : plus de pilote global, même adopté d'un état étranger
  S.concours = (S.concours && typeof S.concours === "object") ? S.concours : {};
  S.concoursDone = (S.concoursDone && typeof S.concoursDone === "object") ? S.concoursDone : {};
  /* S25 — les étoiles sont un AJOUT de champ, pas un changement de schéma :
     un état qui n'en a pas repart à zéro étoile plutôt que d'être rejeté. */
  { const st = (S.stars && typeof S.stars === "object") ? S.stars : {}; S.stars = {};
    for (const cid in st){ const n = st[cid] | 0;
      if (tournamentById(cid) && n >= 1 && n <= 3) S.stars[cid] = n; } }
  for (const cid in S.concours){ const st = S.concours[cid];
    if (st && st.lock) st.lock.chassis = validChassis(st.lock.chassis); }
  /* A2 — SAVE_V, validState et migrate sont déclarés en tête d'état. Une sauvegarde
     d'une version antérieure CONNUE est migrée (v4→v5→v6) avec sauvegarde de secours ;
     une version inconnue déclenche un reset explicite (jamais silencieux). */
  /* P-PLAN-UNIQUE : purge du blindage monté des états adoptés (données du
     slot conservées pour le chantier plaques latérales). */
  (function retireArmor(){
    if (S.parts && S.parts.equipped && S.parts.equipped.armor) S.parts.equipped.armor = null;
    if (S.garage) for (const b of S.garage){
      if (b.fit && b.fit.armor){ for (const u of b.fit.armor) delete S.inv.items[u]; delete b.fit.armor; }
      if (b.equipped && b.equipped.armor) b.equipped.armor = null;
    }
  })();
}
bootSanitize();
syncActive(); recomputeOwned();

/* ══ E6 — gestion des carrières (bascule DOUCE : pas de reload, on recharge
   l'état et on re-rend — le harness comme le navigateur y gagnent). ══ */
function loadCareerState(n){
  saveState();                                           // la carrière quittée est bordée
  localStorage.setItem("roboclash_active", String(n));
  CUR_CAREER = n;
  S = defaultState();
  try { const raw = localStorage.getItem(careerKey(n));
    if (raw){ adoptSave(JSON.parse(raw)); }
  } catch(e){}
  bootSanitize(); syncActive(); recomputeOwned(); saveState();
  if (typeof NAV !== "undefined" && NAV.reset) NAV.reset();
  renderHome();
  if (SAVE_RESET_NOTICE){ SAVE_RESET_NOTICE = false; try { showToast(t("saveReset")); } catch(_){} }   // Phase 3 : reset EXPLICITE
}
function newCareerState(){
  /* E7 — une NOUVELLE carrière commence en S : PETIT RUSTY, coque tortue_s
     assemblée (kit de base en vraies instances), patiné (usure 12 %), 35 €.
     Les carrières adoptées ne passent jamais par ici. */
  const st = defaultState();
  st.inv = { seq:0, items:{} };
  const bot = newBotInto(st.inv, "tortue_s");
  bot.customName = "PETIT RUSTY";
  bot.customize = bot.customize || {}; bot.customize.color = "#b14bff";  // E8 : violet joueur
  bot.chassisWear = 12;
  st.garage = [bot]; st.activeBot = 0;
  st.bolts = 40;   // E7b : la simulation a tranché (35 ratait le premier achat de 2 euros)
  return st;
}
/* P-CRESUS — carrière de TEST. Nommer une carrière « cresus » (accents et
   casse indifférents) la dote d'un trésor de guerre : de quoi acheter tout le
   catalogue et mesurer sans grinder. Ce n'est pas un easter egg à trouver,
   c'est un outil : personne ne le tape par accident, et la carrière porte son
   nom en clair — on sait toujours qu'on mesure sur une carrière truquée. */
const CRESUS_MOT = "cresus", CRESUS_BOLTS = 999999;
const estCresus = (name) => String(name || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .trim().toLowerCase() === CRESUS_MOT;
function createCareer(name){
  for (let n = 1; n <= CAREER_MAX; n++){
    if (!localStorage.getItem(careerKey(n))){
      const fresh = newCareerState(); fresh.careerName = name || ("Carri\u00E8re " + n);
      if (estCresus(name)) fresh.bolts = CRESUS_BOLTS;
      localStorage.setItem(careerKey(n), JSON.stringify(fresh));
      loadCareerState(n);
      showIntro(()=>showBotReceived("tortue_s", "PETIT RUSTY", t("recvStarterSub"), null, AB()));   // E9 + S36 : bot COMPLET
      return n;
    } }
  return null;                                           // plein (3/3)
}
function deleteCareer(n){
  localStorage.removeItem(careerKey(n));
  if (CUR_CAREER === n){ localStorage.removeItem("roboclash_active"); CUR_CAREER = null; }
}

let SAVE_ERR_SHOWN = false;
function saveState(){                                          // A1 : plus d'échec de sauvegarde silencieux
  try{ if (CUR_CAREER) localStorage.setItem(careerKey(CUR_CAREER), JSON.stringify(S)); return true; }
  catch(e){
    logError("save", (e && e.message) || String(e));
    if (!SAVE_ERR_SHOWN){ SAVE_ERR_SHOWN = true; try { showToast(t("saveError")); } catch(_){} }
    return false;
  }
}
LANG = S.lang;

/* E1 : le barème vit dans data.js (WIN_EUR). Alias local pour les lecteurs. */
const WIN_BOLTS = WIN_EUR;
// software (behaviour pack) unlocks pilot controls gradually: s0 basics, s1 approach/charge, s2 handling/strategy.
const CONTROL_TIER = { aggression:0, edgeGuard:0, approach:1, chargeDist:1, handling:2, strategy:2, power:0 };
/* P-PILOTE — le palier lisait les logiciels POSSÉDÉS : acheter s2 une fois
   déverrouillait la stratégie sur TOUT le garage, y compris sur un bot resté
   en s0. Il lit désormais le logiciel MONTÉ sur le bot actif (slot optionnel :
   equipped.software === null ≡ s0).
   TODO Phase 1.3 — handling et power sont MÉCANIQUES (propulsion / moteur) :
   à rattacher là, pas ici. Piège à désamorcer d'abord : makeSeg rabat un
   contrôle verrouillé sur OPTS[key][0], qui vaut "speed" pour power et
   "short" pour chargeDist — soit PAS la valeur par défaut du build. */
function fittedSwTier(){ const id = (AB().equipped && AB().equipped.software) || "s0";
  return Math.max(0, ENGINE.PARTS.software.findIndex(p=>p.id===id)); }
const isUnlocked = (key)=>{ const n=CONTROL_TIER[key]; return n==null || fittedSwTier()>=n; };
/* P1-d — pilote EFFECTIF : le pilote STOCKÉ (bot.pilot) est intact ; tout contrôle
   verrouillé par le logiciel monté retombe sur son défaut DÉCLARÉ (PILOT_DEF), pas
   sur OPTS[key][0]. Seul ce résultat entre en piste ; le rendu ne mute rien. */
function effectivePilot(bot){
  const p = (bot && bot.pilot) || PILOT(), out = {...p};
  for (const key of PILOT_KEYS) if (!isUnlocked(key)) out[key] = PILOT_DEF[key];
  return out;
}
const tournamentOpen = ()=> S.beatenAtLevel >= 2;
const pickName = ()=> OPP_NAMES[2 + Math.floor(Math.random()*(OPP_NAMES.length-2))];

function ensureOpponent(){
  if (S.opponent) return;
  const T = ENGINE.SLICE1.teaching;
  if (S.level === 1 && S.beatenAtLevel < T.length){
    const te = T[S.beatenAtLevel];
    S.opponent = { name:OPP_NAMES[te.nameIdx], archetype:te.archetype,
      build:{...te.build}, level:1 };
  } else {
    const g = genOpponentFit(Math.floor(Math.random()*1e9), S.level);
    S.opponent = { name:pickName(), archetype:g.archetype, build:g.build, level:S.level,
      gen:true, losses:0 };
  }
  saveState();
}

function ensureTourney(){
  if (S.tourney) return;
  const seed = Math.floor(Math.random()*1e9);
  const opps = ENGINE.genTournament(seed, S.level).map(g => ({ ...g, build: repairFit(g.build) }));   // S23
  S.tourney = { idx:0, opponents: opps.map(g=>({ name:pickName(),
    archetype:g.archetype, build:g.build, level:S.level })) };
  saveState();
}

/* ============================================================
   HOME SCREEN
   ============================================================ */
const $ = (id)=>document.getElementById(id);
const PLAYER_COLOR = "#b14bff", ENEMY_COLOR = "#ff2a4a";   // DA : violet joueur / rouge adverse

// Displayed figures come bottom-up from the physical reference bank — one
// coherent source. kg = Σ real component masses; Nm/kW = motor nameplate;
// Wh = real LiPo pack. Robot-sumo class (dohyo 154 cm, ≤20×20 cm, ≤3 kg).
function renderNums(el, build){
  const p = ENGINE.physStats(build);
  el.innerHTML =
    `<span>${t("ndWeight")} <b>${p.massKg.toFixed(2)} kg</b></span>`+
    `<span>${t("ndPower")} <b>${p.powerKW.toFixed(2)} kW</b></span>`+
    `<span>${t("ndTorque")} <b>${p.torqueNm.toFixed(2)} Nm</b></span>`+
    `<span>${t("ndBattery")} <b>${p.packWh.toFixed(1)} Wh</b></span>`;
}
function weightClass(build){
  const w = ENGINE.physStats(build).massKg; // real assembled mass (kg)
  return w < 1.2 ? "classLight" : w < 2.0 ? "classMid" : "classHeavy";
}

function renderHome(){
  const inTourney = tournamentOpen();
  if (inTourney) ensureTourney(); else ensureOpponent();

  // header
  $("lvlLabel").textContent = t("level")+" "+S.level + (S.champion ? " · "+t("champion")+" 🏆" : "");
  $("dots").textContent = inTourney ? "🏟" :
    "●".repeat(S.beatenAtLevel) + "○".repeat(Math.max(0, 2-S.beatenAtLevel));
  $("winsLabel").textContent = " ⚔ " + S.beaten;          // P2 : niveau sommaire = combats gagnes (extensible)
  $("boltsLabel").innerHTML = BOLT_SVG + " " + S.bolts;
  $("badgesLabel").textContent = S.badges.length ? " " + "🏅".repeat(S.badges.length) : "";
  document.querySelectorAll("#langSeg .rc-seg__opt").forEach(o=>o.classList.toggle("is-active", o.dataset.lang===LANG));

  // tournament banner + friendly button
  const banner = $("tourneyBanner");
  if (inTourney){
    banner.style.display = "block";
    $("tourneyTitle").textContent = t("tourneyTitle", {l:S.level, i:S.tourney.idx+1});
    const prize = WIN_BOLTS[S.level]*5;
    $("tourneyPrize").textContent = S.level >= 5
      ? t("tourneyChampPrize", {p:prize})
      : t("tourneyPrize", {p:prize, n:S.level+1});
  } else {
    banner.style.display = "none";
  }

  // player machine: live numbers + robot editor with equipped parts
  // (le versus et les réglages de comportement vivent sur l'écran VS — S6)
  const myBuild = {...PILOT(), chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}, color:S.customize.color, stickers0:S.customize.placed};
  myBuild.beamCells = beamCellsOf(myBuild, getLayout());                       // S16-WHEELS : la pesee compte les longerons
  renderNums($("myNums"), myBuild);
  bindEditor();
  renderLayerTabs();
  drawEditor($("editorCv"), myBuild, getLayout(), editSpin, editFocus, showCG, showHB);

  // stat bars (react to Power AND equipped parts)
  const bars = ENGINE.statBars(myBuild);
  const names = {speed:"stSpeed", push:"stPush", leverage:"stLeverage",
                 traction:"stTraction", energy:"stEnergy"};
  const sb = $("statBars"); sb.innerHTML = "";
  for (const [k,frac] of Object.entries(bars)){
    const s = document.createElement("div");
    s.innerHTML = `<div class="rc-stat__label">${t(names[k])}</div>
      <div class="rc-bar"><div class="rc-bar__fill" style="width:${Math.round(frac*100)}%"></div></div>`;
    sb.appendChild(s);
  }

  renderLigues();
  if ($("ligueScreen").style.display === "block") renderLigueScreen();
  if ($("chassisScreen").style.display === "block") renderChassisScreen();
  if ($("vsScreen").style.display === "block") renderVsScreen();   // S38-HUB : le classement vit sur l'écran VS (renderVsScreen le pose)
  renderGarage();
  renderGarageStrip();
  renderInventory();
  renderChassisShop();
  renderWorkshop();
  renderCustomize();

  document.querySelectorAll("[data-i18n]").forEach(el=>el.textContent = t(el.dataset.i18n));
  tilesDirty();                                            // B1 : cale les backings sur les tailles CSS réelles
}

function renderCustomize(){
  const cr=$("colorRow");
  if(cr){ cr.innerHTML="";
    for(const col of CHASSIS_COLORS){ const sw=document.createElement("div");
      sw.className="swatch"+(S.customize.color===col?" on":""); sw.style.background=col;
      sw.onclick=()=>{ S.customize.color=col; saveState(); renderCustomize();
        tilesDirty(); };                       // S16-GARAGE : vignettes du garage a jour en direct
      cr.appendChild(sw); } }
  const sr=$("stickerRow");
  if(sr){ sr.innerHTML="";
    if(!ownedStickerIds().length){ const hint=document.createElement("div");
      hint.className="stickerhint"; hint.textContent=t("stickerShopHint"); sr.appendChild(hint); }
    for(const id of ownedStickerIds()){ const st=stickerOf(id); if(!st) continue;
      const count=S.customize.placed.filter(p=>p.id===id).length;
      const sw=document.createElement("div");
      sw.className="swatch"+(count?" on":"");
      const im=document.createElement("img"); im.src=st.src; im.alt=id;
      im.style.cssText="max-width:80%;max-height:80%;object-fit:contain"; sw.appendChild(im);
      sw.title=t("stickerPlace");
      if(count>1){ const badge=document.createElement("div"); badge.className="px"; badge.textContent="×"+count; sw.appendChild(badge); }
      sw.onclick=()=>{ // each tap adds ONE MORE copy; drag it off the hull to remove
        const cell=freeChassisCell({chassis:AB().chassis,parts:{...S.parts.equipped}, counts:{...AB().counts}}, getLayout())||{col:4.5,row:4};
        S.customize.placed.push({id, x:cell.col+0.5, y:cell.row+0.5});
        saveState(); renderCustomize();
      };
      sr.appendChild(sw); }
    if(S.customize.placed.length){ const hint=document.createElement("div");
      hint.className="stickerhint"; hint.textContent=t("stickerDragHint"); sr.appendChild(hint); }
  }
}

function makeSeg(key){
  /* FID-2 + S15 — un contrôle verrouillé n'est PAS montré : il n'existe pas
     tant que le logiciel requis n'est pas monté (mention unique côté appelant). */
  const unlocked = isUnlocked(key);
  // P1-d : un contrôle verrouillé n'est pas rendu — et le RENDU NE MUTE PLUS le
  // pilote stocké. Le réglage EFFECTIF (défaut déclaré) est appliqué au combat
  // par effectivePilot(), pas ici. La distinction stocké/effectif/visible est nette.
  if (!unlocked) return null;
  const field = document.createElement("div"); field.className = "rc-field";
  const head = document.createElement("div"); head.className = "rc-field__head";
  head.innerHTML = `<span>${t(key)}</span>
    <span class="rc-field__val">${t(PILOT()[key])}</span>`;
  field.appendChild(head);
  const seg = document.createElement("div"); seg.className = "rc-seg";
  for (const opt of ENGINE.OPTS[key]){
    const o = document.createElement("div");
    o.className = "rc-seg__opt" + (PILOT()[key]===opt ? " is-active" : "");
    o.textContent = t(opt);
    o.onclick = ()=>{ if(!isUnlocked(key)) return; PILOT()[key]=opt; saveState(); renderHome(); };
    seg.appendChild(o);
  }
  field.appendChild(seg);
  return field;
}

// A3 — résumé INDICATIF des effets, lu sur les champs d'affichage du catalogue
// (part.push/speed/energy/…). Ce n'est PAS la vérité simulée : la dynamique vient
// d'ENGINE.PHYS (bottom-up). Seule la masse (partMassKg) ci-dessous est physique.
function partFx(slot, part){
  const pc = (x)=> (x>1?"+":"")+Math.round((x-1)*100)+" %";
  const bits = [];
  if (part.push && part.push!==1)       bits.push(pc(part.push)+" "+t("stPush"));
  if (part.speed && part.speed!==1)     bits.push(pc(part.speed)+" "+t("stSpeed"));
  if (part.energy && part.energy!==1)   bits.push(pc(part.energy)+" "+t("stEnergy"));
  if (part.traction && part.traction!==1) bits.push(pc(part.traction)+" "+t("stTraction"));
  if (part.leverage)                    bits.push("+"+part.leverage.toFixed(2)+" "+t("stLeverage"));
  if (part.grip)                        bits.push("+"+part.grip.toFixed(2)+" "+t("stTraction"));
  if (part.interval)                    bits.push(t("fx_interval")+" ×"+(18/part.interval).toFixed(1));
  if (part.gain && part.gain!==1)       bits.push(t("fx_gain")+" "+pc(part.gain));
  if (part.noise!==undefined && part.noise<1) bits.push(t("fx_noise")+" +"+Math.round((1-part.noise)*100)+" %");
  if (part.srMul!==undefined && part.srMul<1) bits.push(t("fx_sr")+" −"+Math.round((1-part.srMul)*100)+" %");
  if (part.drain!==undefined && part.drain<1) bits.push(t("fx_drain")+" −"+Math.round((1-part.drain)*100)+" %");
  if (part.edgePush)                    bits.push(t("fx_edgePush"));
  const kg = ENGINE.partMassKg(slot, part.id);
  if (kg)                               bits.push("+"+(kg*1000).toFixed(0)+" g");
  return bits.length ? bits.join(" · ") : t("stock");
}

/* P-PLAN-UNIQUE : le blindage sort des catalogues jouables (données conservées
   pour le chantier plaques latérales). */
const RETIRED_SLOTS = { armor:1 };
/* Boutique — masquages : on épure la VITRINE, le moteur/éditeur ne changent pas.
   Les 2 armes (clutter, réintro plus tard), la roue large blindée pr9, et les
   options « aucun » qu'on n'achète pas (lest/srimech). */
const SHOP_HIDE_SLOTS = { weapon1:1, weapon2:1 };
const SHOP_HIDE_PARTS = { pr9:1 };
const SHOP_HIDE_NONE  = { ballast:1, srimech:1 };
const CLASS_COLORS = { S:"#4dff88", M:"#ff9b3d", L:"#5a7dff", XXL:"#b14bff" };   // pastille de classe (vitrine)
const SLOT_ORDER = ["chassis","propulsion","motor","cpu","battery","armor",
  "weapon1","weapon2","software","ballast","sensors","srimech","cooling"];

/* ============================================================
   ROBOT EDITOR — placeable part tiles on a fixed chassis.
   Simple placeholder visuals: one primitive per part, colour = tier.
   Parts are grouped in layers (fixed Z); no overlap WITHIN a layer.
   Layout is data on the robot, so it travels to shop/scout/combat and
   to other robots later. Real assets replace the tiles down the line.
   ============================================================ */
const TIER_COLORS = ["#5b6472","#28c39a","#3b82f6","#f0a020","#a78bfa"]; // stock → top tier
// --- visual customisation ---
// mid-tone palette: the chassis sprite is colourised via multiply, so very dark
// or muddy colours crush plate detail — every entry here keeps it readable.
/* E8 — palette alignée sur les tokens du thème (rc-red / rc-violet / rc-amber
   + famille néon de même saturation). BLANC = pas de recoloration (sprite nu). */
const NO_TINT = "#ffffff";
const CHASSIS_COLORS = [NO_TINT, "#b14bff", "#ff2a4a", "#ff9b3d", "#3de8ff",
  "#4dff88", "#ff4dd2", "#5a7dff", "#ffe14d"];
const DEFAULT_CHASSIS_COLOR = "#d98a45";   // jaune-orangé — un Rusty naît solaire, pas gris-bleu
/* S10 — STICKERS/VSTICKERS viennent de data.js (sprites). */
function stickerOf(id){ return STICKERS.find(s=>s.id===id) || VSTICKERS.find(v=>v.id===id) || null; }
const _stkImg = {};
function stickerImg(id){ const st=stickerOf(id); if(!st) return null;
  return _stkImg[id] || (_stkImg[id]=mkImg(st.src)); }
function softwareOwned(def){ return !!def && invCount(def) > 0; }
/* possédés = achetés (par bot) ∪ plaques de version dérivées du logiciel possédé (global) */
function ownedStickerIds(){
  const ids = [...(S.customize.stickers||[])];
  for (const v of VSTICKERS) if (v.sw === null || softwareOwned(v.sw)) ids.push(v.id);
  return ids;
}
function opponentColor(seed){ // deterministic hull colour for opponents
  let h=(seed>>>0)||1; h=(h*2654435761)>>>0; return CHASSIS_COLORS[h % CHASSIS_COLORS.length]; }
function nameSeed(s){ let h=0; s=s||""; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h||1; }
function ensureOppColor(o){ if(o&&o.build&&!o.build.color) o.build.color=opponentColor(nameSeed(o.name)); return o; }
const PART_GLYPH = { propulsion:"", motor:"M", battery:"B", cpu:"C", cooling:"K",
  ballast:"L", srimech:"R", sensors:"N", software:"S", weapon1:"W", weapon2:"X" };



// ---- interaction (grid-snap; per-level constraints) ----
let editFocus=-1, editSpin=0, editDrag=null, showCG=false, showHB=false;
function editorBoardPoint(canvas, ev){ const rect=canvas.getBoundingClientRect();
  /* S17-VIEW — MEME constante que le dessin : cette transformation est son
     inverse exact. Si les deux divergent, chaque toucher tombe a cote — la
     source silencieuse des "interactions approximatives" du playtest. */
  const sc=(Math.min(canvas.width,canvas.height)*BOT_FRAME)/BOARD_HALF;
  const sx=canvas.width/rect.width, sy=canvas.height/rect.height;
  return { x:((ev.clientX-rect.left)*sx-canvas.width/2)/sc, y:((ev.clientY-rect.top)*sy-canvas.height/2)/sc }; }
function pxToCell(chassis,x,y){ const v=viewParams(chassis);
  return { col:Math.floor(x/v.cell+v.ccol), row:Math.floor(y/v.cell+v.crow) }; }
function editorHit(layout, cell){
  if(editFocus<0 || editFocus===STICKER_LAYER){
    for(let i=S.customize.placed.length-1; i>=0; i--){ const d=S.customize.placed[i];
      const cx = d.x ?? (d.col+0.5), cy = d.y ?? (d.row+0.5);
      /* S18 — la zone de saisie suit l'échelle de dessin : sur un bot S le
         sticket est deux fois plus petit, sa prise doit l'être aussi. */
      const k = STICKER_SCALE[chassisClassOf(AB().chassis)] || 1;
      if(Math.abs(cx-(cell.col+0.5))<=1.0*k && Math.abs(cy-(cell.row+0.5))<=0.8*k) return {sticker:i}; } }
  if(editFocus===STICKER_LAYER) return null;
  for(let li=EDIT_LAYERS.length-1; li>=0; li--){ if(editFocus>=0&&editFocus!==li) continue;
    for(const slot of EDIT_LAYERS[li].slots){ const p=layout[slot]; if(!p) continue;
      if(!isMounted(slot, curId(slot))) continue;
      const f=footprintOf(slot, curId(slot));
      const M=0.38;                                 // marge tactile : une 1×1 se saisit au doigt
      const inRect=(col)=>cell.col>=col-M&&cell.col<col+f.w+M&&cell.row>=p.row-M&&cell.row<p.row+f.d+M;
      if(inRect(p.col)) return slot;
      /* S31 — `build` n'existe PAS dans cette portee : editorHit(layout, cell).
         Chaque pointerdown sur une roue jetait un ReferenceError, le geste mourait
         et le journal se remplissait. Le chassis actif se lit par AB(), comme
         partout ailleurs dans ce fichier. */
      if(li===0 && inRect(mirrorCol(AB().chassis,p.col,f.w))) return slot; // right wheel selects the pair
    } }
  return null; }
function bindEditor(){ const cv=$("editorCv"); if(!cv||cv._bound) return; cv._bound=true;
  cv.style.touchAction = "pan-y";              // P5 : le scroll vertical passe si on ne saisit rien
  cv.addEventListener("pointerdown",(ev)=>{ const L=getLayout(); const pt=editorBoardPoint(cv,ev);
    const cell=pxToCell(AB().chassis,pt.x,pt.y); const hit=editorHit(L,cell); if(!hit) return;
    ev.preventDefault();                       // une pièce est saisie : le drag prime sur le scroll
    if(typeof hit==="object" && hit.sticker!=null){ editDrag={sticker:hit.sticker}; cv.setPointerCapture(ev.pointerId); return; }
    const slot=hit;
    editDrag={slot, dCol:cell.col-L[slot].col, dRow:cell.row-L[slot].row}; cv.setPointerCapture(ev.pointerId); });
  cv.addEventListener("pointermove",(ev)=>{ if(!editDrag) return; const L=getLayout();
    const pt=editorBoardPoint(cv,ev); const cell=pxToCell(AB().chassis,pt.x,pt.y);
    if(editDrag.sticker!=null){
      // S10 : placement LIBRE — la grille ne contraint plus les décalcomanies.
      // Glisser hors de la coque supprime (géré au pointerup).
      const v=viewParams(AB().chassis);
      const cx = pt.x/v.cell + v.ccol, cy = pt.y/v.cell + v.crow;
      const inside = cellInChassis(AB().chassis, Math.floor(cx), Math.floor(cy));
      const d=S.customize.placed[editDrag.sticker];
      d.x=cx; d.y=cy; delete d.col; delete d.row; editDrag.off=!inside;
      return; }
    let col=cell.col-editDrag.dCol, row=cell.row-editDrag.dRow;
    const slot=editDrag.slot, li=SLOT_LAYER[slot];
    const f=footprintOf(slot, curId(slot));
    const floor = li===1 ? (L[slot].floor||0) : 0;              // keep the part's floor
    const others=EDIT_LAYERS[li].slots.filter(o=>o!==slot && isMounted(o,curId(o)) && (li!==1 || (L[o].floor||0)===floor))
      .map(o=>({...L[o], f:footprintOf(o,curId(o))}));
    const np = li===1 ? {col,row,floor} : {col,row};
    if(placementOK(AB().chassis, slot, np, others)){ AB().layout={...L,[slot]:np}; } });
  const end=()=>{ if(editDrag){
    if(editDrag.sticker!=null && editDrag.off){ S.customize.placed.splice(editDrag.sticker,1); renderCustomize(); }
    editDrag=null; saveState(); } };
  cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",end);
}
function autoArrangeCurrent(){ AB().layout=autoArrange({chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}}); saveState(); }
function renderLayerTabs(){ const el=$("layerTabs"); if(!el) return; el.innerHTML="";
  const mk=(label,idx)=>{ const b=document.createElement("button"); b.className="rc-toolbtn"+(editFocus===idx?" is-on":"");
    b.textContent=label; b.onclick=()=>{ editFocus=(editFocus===idx?-1:idx); renderLayerTabs(); }; el.appendChild(b); };
  mk(t("layAll"),-1); EDIT_LAYERS.forEach((L,i)=>mk(t("lay_"+L.id),i)); mk(t("layStickers"),STICKER_LAYER); }
function previewLoop(ts){ editSpin=(ts||0)/1000*3;
  if(typeof activeTab!=="undefined"){
    if(activeTab==="workshop"&&$("editorCv")){
      const ecv=$("editorCv"), dpr=window.devicePixelRatio||1,
            need=Math.round((ecv.clientWidth||640)*dpr);
      if (need>0 && Math.abs(ecv.width-need)>1){ ecv.width=need; ecv.height=need; }
    }
    if(activeTab==="workshop"&&$("editorCv"))
      drawEditor($("editorCv"), buildOfBot(AB()), getLayout(), editSpin, editFocus, showCG, showHB);   // S17-VIEW
    if($("vsScreen")&&$("vsScreen").style.display==="block"&&$("scoutCv")&&$("scoutCv")._oppBuild){
      const ob=$("scoutCv")._oppBuild; if(!ob.color)ob.color=opponentColor(nameSeed(ob.name||""));
      { const pw=$("scoutCv").parentElement;                                     // S14 : fond adverse garanti
        if (pw && pw.classList.contains("rc-portrait") &&
            !pw.classList.contains("rc-portrait--foe1") && !pw.classList.contains("rc-portrait--foe2")){
          let hh=0; for(const ch of (ob.name||"")) hh=(hh*31+ch.charCodeAt(0))>>>0;
          pw.classList.add(hh%2 ? "rc-portrait--foe2" : "rc-portrait--foe1"); } }
      drawEditor($("scoutCv"), ob, autoArrange(ob), editSpin, -1);
      if($("playerCv")&&$("playerCv")._build) drawEditor($("playerCv"), $("playerCv")._build, getLayout(), editSpin, -1);
    }
  }
  requestAnimationFrame(previewLoop);
}
requestAnimationFrame(previewLoop);

function renderWorkshop(){
  const rows = $("slotRows"); rows.innerHTML = "";
  /* E7b — CONTRÔLE TECHNIQUE : le miroir en jeu de notre porte. */
  { const build = { chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts} };
    const fc = functionalCheck(build);
    const ct = document.createElement("div");
    ct.id = "ctPanel"; ct.className = "rc-ct " + (fc.ok ? "rc-ct--ok" : "rc-ct--ko");
    if (fc.ok){
      const st = ENGINE.physStats(build);
      ct.innerHTML = `<div class="rc-ct__line">${t("ctOk")}</div>
        <div class="rc-ct__sub">${t(weightClass(build))} \u00B7 ${st.massKg.toFixed(2)} kg</div>`;
    } else {
      ct.innerHTML = fc.fails.map(f=>`<div class="rc-ct__line">\u2717 ${f}</div>`).join("");
    }
    rows.appendChild(ct); }
  /* E7b — garage v2 : le tableau montre CE QUI EST MONTÉ, rien d'autre.
     L'ajout passe par « + AJOUTER COMPOSANT » (inventaire libre) ; le retrait
     libère l'instance vers l'inventaire. Plus de catalogue en garage. */
  const fittedSlots = SLOT_ORDER.filter(sl =>
    sl === "chassis" || (AB().fit && AB().fit[sl] && AB().fit[sl].length));
  for (const slot of fittedSlots){
    if (RETIRED_SLOTS[slot]) continue;                       // P-PLAN-UNIQUE
    const row = document.createElement("div"); row.className = "slotrow";
    const nm = document.createElement("div"); nm.className = "sname";
    nm.textContent = t("slot_"+slot);
    row.appendChild(nm);
    const cur = document.createElement("div"); cur.className = "scur";
    if (slot === "chassis"){
      cur.innerHTML = `${chassisName(AB().chassis)}<span class="pfx">${t("weldedChassis")}</span>`;
      row.appendChild(cur);
    } else {
      const eqId = S.parts.equipped[slot] ?? EMPTY_ID[slot];
      const part = ENGINE.partOf(slot, eqId);
      const tile = document.createElement("div"); tile.className = "stile";     // P1 : vignette visuelle
      const tcv = tileCanvas(44, (c2)=>drawPartTile(c2, slot, eqId, 22, 22, 40, 34, 0, 1));
      tile.appendChild(tcv); row.appendChild(tile);
      cur.innerHTML = `${t("pn_"+eqId)}<span class="pfx">${partFx(slot, part)}</span>`;
      row.appendChild(cur);
      /* E3b : l'usure de la pièce équipée est visible et réparable ici. */
      { const uids = (AB().fit && AB().fit[slot]) || [];
        const worn = uids.map(u=>S.inv.items[u]).filter(it=>it && it.wear>0);
        if (worn.length){
          const wmax = Math.max(...worn.map(it=>it.wear));
          const chip = document.createElement("span");
          chip.className = "rc-wear" + (wmax>=100 ? " rc-wear--hs" : wmax>60 ? " rc-wear--bad" : "");
          chip.textContent = wmax>=100 ? t("dmgHS") : da(t("wearPct",{w:Math.round(wmax)}));
          row.appendChild(chip);
          const cost = worn.reduce((a,it)=>a+repairCostOf(slot,it.def,it.wear),0);
          const rb = document.createElement("button"); rb.className = "rc-toolbtn";
          rb.textContent = da(t("repair",{c:cost}));
          rb.disabled = S.bolts < cost;
          rb.onclick = ()=>{ for (const u of uids){ const it=S.inv.items[u];
              if (it && it.wear>0) repairInstance(u); } };
          row.appendChild(rb);
        } }
      { const rm = document.createElement("button"); rm.className = "rc-toolbtn rc-toolbtn--rm";
        rm.textContent = t("removePart");
        rm.onclick = ()=>{ tryEquip(slot, null); };                     // E7b : libère vers l'inventaire (tryEquip rend)
        row.appendChild(rm); }
      /* P1 : le bouton Boutique par ligne est retiré — l'accès boutique passe
         par l'onglet et la cellule du botstrip. */
      if (STACK_SLOTS[slot] && !(slot==="ballast" && eqId==="l0")){   // stack control
        const n = AB().counts[slot]||1;
        const step = document.createElement("div"); step.className="stepper";
        const minus=document.createElement("button"); minus.className="stepbtn"; minus.textContent="\u2212"; minus.disabled=n<=1;
        const lbl=document.createElement("span"); lbl.className="stepn"; lbl.textContent="\u00D7"+n;
        const plus=document.createElement("button"); plus.className="stepbtn"; plus.textContent="+";
        minus.onclick=()=>setCount(slot,-1); plus.onclick=()=>setCount(slot,+1);
        step.append(minus,lbl,plus); row.appendChild(step);
      }
    }
    rows.appendChild(row);
  }
  /* E7b — + AJOUTER COMPOSANT : sélecteur limité à l'INVENTAIRE LIBRE. */
  { const add = document.createElement("button");
    add.className = "rc-btn rc-btn--ghost rc-btn--block"; add.id = "addPartBtn";
    add.textContent = "+ " + t("addPart");
    add.onclick = ()=>{ ADD_PICKER_OPEN = true; renderAddPicker(); };
    rows.appendChild(add);
    const pick = document.createElement("div"); pick.id = "addPicker"; pick.style.display = "none";
    rows.appendChild(pick);
    if (ADD_PICKER_OPEN) renderAddPicker(); }                        // S16-EDIT : survit au re-rendu
}
let ADD_PICKER_OPEN = false;                                        // S16-EDIT : etat du selecteur d'ajout
function renderAddPicker(){
  const pick = $("addPicker"); if (!pick) return;
  pick.style.display = "block"; pick.innerHTML = "";
  const groups = {};
  for (const u in S.inv.items){ const it = S.inv.items[u];
    if (fittedMap()[u]) continue;
    const sl = DEF_SLOT[it.def]; if (!sl) continue;
    (groups[sl] ||= {})[it.def] = (groups[sl][it.def]||0) + 1; }
  let any = false;
  for (const sl of SLOT_ORDER){
    if (!groups[sl]) continue; any = true;
    const h = document.createElement("div"); h.className = "rc-section"; h.textContent = t("slot_"+sl);
    pick.appendChild(h);
    const strip = document.createElement("div"); strip.className = "rc-tiles";
    for (const def in groups[sl]){
      const tl = document.createElement("div"); tl.className = "rc-tile";
      const gl = document.createElement("div"); gl.className = "rc-tile__glyph";
      gl.appendChild(tileCanvas(40, (c2)=>drawPartTile(c2, sl, def, 20, 20, 36, 31, 0, 1)));
      tl.appendChild(gl);
      const nm = document.createElement("div"); nm.className = "rc-tile__name";
      nm.textContent = t("pn_"+def) + (groups[sl][def]>1 ? " \u00D7"+groups[sl][def] : "");
      tl.appendChild(nm);
      tl.onclick = ()=>{ ADD_PICKER_OPEN = true;                     // S16-EDIT : rester ouvert pour enchainer
        if (!tryEquip(sl, def)){ ADD_PICKER_OPEN = false; showToast(t("ct_place")); } };
      strip.appendChild(tl);
    }
    pick.appendChild(strip);
  }
  if (!any){
    const e = document.createElement("div"); e.className = "rc-label";
    e.textContent = t("invShop");                     // picker + bouton boutique : message orienté ACHAT
    pick.appendChild(e);
    const b = document.createElement("button"); b.className = "rc-btn rc-btn--block";
    b.textContent = t("tabShop"); b.onclick = ()=>goTab("shop");
    pick.appendChild(b);
  }
  tilesDirty();
}


/* ---- S2 : API de mutation unique. Toute modification d'équipement passe
   par tryFit ; personne n'écrit fit/equipped/counts directement. ---- */
function invChanged(){ S.garage.forEach(b=>refit(b)); syncActive(); recomputeOwned(); saveState(); }
/* tryFit — remplace le contenu d'un slot par ces uids, sous contrat :
   uids existants, libres (ou déjà dans CE slot de CE bot), tous du même def,
   def appartenant au slot ; slot obligatoire jamais vide ; validé au layout. */
function tryFit(bot, slot, uids){
  const bi = S.garage.indexOf(bot), fm = fittedMap();
  if (uids.length){
    const d0 = (S.inv.items[uids[0]]||{}).def;
    if (new Set(uids).size !== uids.length) return false;
    for (const uid of uids){
      const it = S.inv.items[uid];
      if (!it || it.def !== d0 || DEF_SLOT[it.def] !== slot) return false;
      const w = fm[uid];
      if (w && !(w.bot === bi && w.slot === slot)) return false; }
  } /* E7b : tout slot peut être vidé — le contrôle technique juge la fonction. */
  const prev = bot.fit[slot] || [];
  bot.fit[slot] = uids; refit(bot);
  const build = {chassis:bot.chassis, parts:{...bot.equipped}, counts:{...bot.counts}};
  const L = autoArrange(build);
  if (!layoutValid(build, L)){ bot.fit[slot] = prev; refit(bot); return false; }
  bot.layout = L; return true;
}
// stack ± : monte une instance libre du même def (sinon en achète une), démonte la dernière.
function setCount(slot, delta){
  const b = AB(), cur = b.fit[slot] || [];
  if (!cur.length) return;
  const def = (S.inv.items[cur[0]]||{}).def;
  if (delta > 0){
    let uid = freeUids(def)[0], cost = 0;
    if (!uid){
      cost = (ENGINE.partOf(slot, def)||{}).cost || 0;
      if (S.bolts < cost){ showToast(t("noBolts")); return; }
      uid = mintInstance(def); }                       // mint spéculatif…
    if (!tryFit(b, slot, cur.concat([uid]))){
      if (cost) delete S.inv.items[uid];               // …annulé si ça ne rentre pas
      showToast(t("noRoom")); return; }
    if (cost) S.bolts -= cost;                         // payé seulement si monté
  } else {
    if (cur.length <= 1) return;
    if (!tryFit(b, slot, cur.slice(0, -1))) return;
  }
  invChanged(); renderHome();
}
/* tryEquip — équipe un def dans un slot : réutilise les instances déjà montées
   du bon def, complète avec les libres (moins usées d'abord), préserve la
   multiplicité tant que le stock libre le permet. null/« vide » → slot vidé. */
function fitsOnHull(build){ return !autoArrange(build).__nofit; }   // E4 : garde-fou de place
/* CALIBRAGE — l'étalon d'un concours, ou null. Donnée pure : une épreuve
   gagne un adversaire figé en écrivant `benchmark:"M3"`, zéro code. */
function benchmarkOf(cid){
  const tr = cid && tournamentById(cid);
  return (tr && tr.benchmark && ENGINE.BENCHMARKS[tr.benchmark]) || null;
}
/* ══ S23-PLAÇABLE — l'adversaire généré doit LOGER dans sa coque.
   `genOpponent` vit dans le moteur, qui ignore tout des empreintes et des
   mises en page (règle d'architecture : engine.js ne référence pas app.js).
   Il produisait donc, en classe S, des bots portant un m3 et des chenilles
   qui n'entrent pas dans une coque 3×3 : mesuré, 31 sur 40 au niveau 3,
   27/40 au 4, 32/40 au 5 — et 0 en classe M. Ils combattaient quand même,
   hitbox rabattue sur la coque nue par la garde S21, en portant la masse et
   la poussée de pièces INVISIBLES. Un adversaire qui ment.

   La réparation appartient donc à l'app, qui, elle, sait mesurer. Même esprit
   que `opts.maxKg` côté moteur : on DÉGRADE, dans un ordre déclaré, jusqu'à
   ce que ça loge — on ne re-tire pas (le tirage doit rester reproductible).
   L'ordre attaque les plus gros encombrements d'abord. En classe S le moteur
   finit souvent au stock : c'est la vérité du contenu actuel (m1 est un 2×2,
   il n'entre que dans totem_s), et elle vaut pour le joueur COMME pour
   l'adversaire. La gamme micro (µ-moteur 1×1) est la vraie réponse. ══ */
/* S24-MICRO — SUBSTITUER avant de dégrader. Le moteur tire ses adversaires
   dans les gammes historiques (m0-m2, pr0-pr3, r1-r2) : il ne connaît pas la
   gamme micro, et ne peut pas la connaître (il ignore les empreintes). Sans
   ceci, une pièce qui ne loge pas serait rabattue au STOCK, alors qu'il existe
   désormais un équivalent de même palier qui, lui, rentre — et l'adversaire de
   classe S resterait éternellement au moteur d'origine pendant que le joueur
   s'offre un µ-Couple. On tente donc l'équivalent micro AVANT la dégradation.
   Même palier, même prix d'ordre de grandeur : ce n'est pas un cadeau, c'est
   la même pièce dans un autre format. */
const EQUIV_MICRO = {
  motor:      { m1:"m5", m2:"m6", m3:"m6", m4:"m5" },
  propulsion: { pr1:"pr6", pr2:"pr7", pr3:"pr8" },
  srimech:    { r1:"r3",  r2:"r4" },
};
const DEGRADE = [
  /* Ordre de SACRIFICE, du moins au plus douloureux. Un bot est d'abord une
     motricité : on lui retire son refroidisseur, son blindage, son lest, puis
     sa réserve d'énergie AVANT de toucher aux roues et au moteur. L'ordre
     précédent (roues et moteur en tête) produisait des adversaires de haut
     niveau au moteur d'origine parce qu'une batterie 2×2 ne rentrait pas —
     ils perdaient leur machine pour sauver leur batterie.
     Dans chaque chaîne : capacité décroissante, encombrement décroissant, les
     formats micro AVANT les stocks (même palier, autre format). */
  ["cooling",    ["k1","k0"]],
  ["armor",      ["a2","a1","a0"]],
  ["ballast",    ["l1","l0"]],
  ["battery",    ["b2","b1","b0"]],
  ["srimech",    ["r4","r3","r0"]],
  ["propulsion", ["pr9","pr8","pr7","pr6","pr5","pr4","pr1","pr0"]],
  ["motor",      ["m6","m5","m1","m0"]],
  // EN DERNIER : le CPU et les capteurs. Ce sont les pièces qui portent le
  // PILOTE — les sacrifier appauvrit le comportement de l'adversaire, pas
  // seulement sa fiche. On ne les touche que si rien d'autre n'a suffi.
  ["cpu",        ["c1","c0"]],
  ["sensors",    ["n1","n0"]],
];
/* gammeDe — le RANG de gamme d'une pièce, jamais sa position dans le tableau.
   Les pièces micro sont ajoutées en fin de catalogue (ids gelés) : m5 est au
   6e rang du tableau mais de gamme 1. Comparer les positions ferait passer
   une substitution micro pour une MONTÉE en gamme et la refuserait. */
function gammeDe(slot, id){
  const p = ENGINE.PARTS[slot].find(x => x.id === id);
  return p ? (typeof p.gamme === "number" ? p.gamme : ENGINE.PARTS[slot].indexOf(p)) : 0;
}
function repairFit(build){
  if (fitsOnHull(build)) return build;
  // 1. l'équivalent micro, à palier ÉGAL : le format change, pas la gamme.
  //    Appliqué EN BLOC — substituer un seul slot ne libère souvent pas assez.
  let substitue = false;
  for (const slot in EQUIV_MICRO){
    const sub = EQUIV_MICRO[slot][build.parts[slot]];
    if (sub){ build.parts[slot] = sub; substitue = true; }
  }
  if (substitue && fitsOnHull(build)) return build;
  /* 2. essais SLOT PAR SLOT, avec retour en arrière. Sans le retour, un slot
        dont la chaîne entière échoue restait à sa pire valeur alors que le
        vrai bloqueur était ailleurs : on obtenait des adversaires au moteur
        ET aux roues d'origine parce qu'une batterie 2×2 ne rentrait pas. */
  for (const [slot, chain] of DEGRADE){
    const avant = build.parts[slot];
    for (const id of chain){
      if (build.parts[slot] === id) continue;
      if (gammeDe(slot, id) >= gammeDe(slot, avant)) continue;   // ne JAMAIS remonter en gamme
      build.parts[slot] = id;
      if (fitsOnHull(build)) return build;
    }
    build.parts[slot] = avant;                                    // ce slot n'était pas le problème
  }
  // 3. dernier recours : on dégrade CUMULATIVEMENT, sans retour en arrière.
  for (const [slot, chain] of DEGRADE){
    for (const id of chain){
      const cur = build.parts[slot];
      if (cur === id || gammeDe(slot, id) >= gammeDe(slot, cur)) continue;
      build.parts[slot] = id;
      if (fitsOnHull(build)) return build;
    }
  }
  return build;                                          // la garde S21 couvre le reste
}
/* genOpponentFit — le SEUL point d'entrée pour fabriquer un adversaire.
   Déterministe : même graine → même bot, réparation comprise. */
function genOpponentFit(seed, level, opts){
  const g = ENGINE.genOpponent(seed, level, opts);
  g.build = repairFit(g.build);
  return g;
}
function opponentOpts(cid){                                            // E7b : adversaires légaux
  const tr = cid && tournamentById(cid); if (!tr || !tr.rules) return undefined;
  const r = tr.rules, o = {};
  if (r.chassisClass) o.allowChassis = Object.keys(CHASSIS_INFO).filter(c=>chassisClassOf(c)===r.chassisClass);
  if (r.chassisClass === "S") o.micro = true;    // S24 : la classe S tire dans la gamme micro
  if (r.banTracks) o.banTracks = true;
  if (r.metrics && r.metrics.weightKg) o.maxKg = r.metrics.weightKg;
  if (r.maxSoftware) o.maxSoftware = r.maxSoftware;   // S29 : l'adversaire subit le même plafond
  return o;
}
/* E7 — contrôle technique : un bot FONCTIONNEL roule, tourne, a du jus et un
   cerveau, et tout loge sur la coque. Sinon il ne combat pas (même en amical). */
const CT_CORE = ["propulsion","motor","battery","cpu"];
function functionalCheck(build){
  const fails = [];
  for (const sl of CT_CORE) if (idAt(build, sl) == null) fails.push(t("ct_"+sl));
  /* P0-1 — un organe vital usé à contribution nulle (batterie/moteur/propulsion
     à eff 0) échoue au CT. `eff` est injecté par l'homologation (engageConcours) ;
     absent (CT d'un adversaire, aperçu), on ne teste pas. */
  if (build.eff) for (const sl of ["motor","battery","propulsion"])
    if (idAt(build, sl) != null && (build.eff[sl] ?? 1) <= 0)
      fails.push(t("ct_worn", { p: t("pn_" + idAt(build, sl)) }));
  if (!fails.length && !fitsOnHull(build)) fails.push(t("ct_place"));
  return { ok: fails.length === 0, fails };
}
function tryEquip(type, id){
  const b = AB(), want = normEquip(type, id);
  let ok;
  if (want == null) ok = tryFit(b, type, []);
  else {
    const cur = b.fit[type] || [];
    const keep = cur.filter(u => (S.inv.items[u]||{}).def === want);
    const free = freeUids(want).filter(u => !keep.includes(u));
    const n = Math.max(1, Math.min(Math.max(cur.length, 1), keep.length + free.length));
    const uids = keep.concat(free).slice(0, n);
    if (!uids.length) return false;
    ok = tryFit(b, type, uids);
  }
  /* S16-EDIT — la liste ne se rafraichissait PAS apres montage/retrait : la
     mutation reussissait, le bot se redessinait (canvas anime), mais le DOM
     restait celui d'avant — d'ou les rangees fantomes et les vignettes
     fausses (le closure de dessin capture l'id au moment de la creation).
     tryEquip est le point de mutation unique du garage : il assume donc la
     sauvegarde ET le rendu, au lieu de compter sur chaque appelant. */
  if (ok){ syncActive(); recomputeOwned(); saveState(); renderHome(); }
  return ok;
}
function mkPartCard(type, part, reserved){
  const card = document.createElement("div"); card.className = "rc-gcard";
  const art = document.createElement("div"); art.className = "rc-gcard__art";
  const cv = tileCanvas(54, (c)=>drawPartTile(c, type, part.id, 27, 27, 50, 44, 0, 1));
  art.appendChild(cv); card.appendChild(art);
  // vitrine : indication d'encombrement (w×d cellules) + pastille de classe si S
  art.style.position = "relative";
  { const fp = footprintOf(type, part.id);
    const fpc = document.createElement("div"); fpc.textContent = fp.w+"×"+fp.d;
    fpc.style.cssText = "position:absolute;right:2px;bottom:2px;font:600 9px var(--rc-f-mono,monospace);color:#cfd6e0;background:rgba(10,8,12,.72);padding:0 3px;border-radius:3px;line-height:13px";
    art.appendChild(fpc); }
  if (part.intendedClass){ const cb = document.createElement("div"); cb.textContent = part.intendedClass;
    cb.style.cssText = "position:absolute;left:2px;top:2px;font:700 9px var(--rc-f-mono,monospace);color:#0a080c;background:"+(CLASS_COLORS[part.intendedClass]||"#888")+";padding:0 4px;border-radius:3px;line-height:13px";
    art.appendChild(cb); }
  const nm = document.createElement("div"); nm.className = "rc-gcard__name"; nm.textContent = t("pn_"+part.id);
  card.appendChild(nm);
  const fx = document.createElement("div"); fx.className = "rc-gcard__fx";
  fx.textContent = reserved
    ? ((type==="weapon1"||type==="weapon2") ? t("noneAvail") : t("stock"))
    : partFx(type, part);
  card.appendChild(fx);
  if (reserved) return card;
  const total = invCount(part.id), elsewhere = installedElsewhere(part.id);
  if (total > 0){
    const al = document.createElement("div"); al.className = "rc-gcard__fx";
    al.textContent = "\u00D7"+total + (elsewhere>0 ? " \u00B7 "+t("onOtherBot",{n:elsewhere}) : "");
    if (elsewhere>0 && elsewhere>=total) al.classList.add("spoken"); // all copies busy elsewhere
    card.appendChild(al);
  }
  const owned = S.parts.owned[type].includes(part.id);
  const equipped = S.parts.equipped[type] === part.id;
  const btn = document.createElement("button"); btn.className = "rc-buy";
  if (equipped){ btn.textContent = t("equipped"); btn.disabled = true; btn.classList.add("is-max"); }
  else if (owned){ btn.textContent = t("equip");
    btn.onclick = ()=>{ if(!tryEquip(type, part.id)) showToast(t("noRoom")); }; }   // S16-EDIT : tryEquip rend
  else { btn.innerHTML = BOLT_SVG + " " + part.cost; btn.disabled = S.bolts < part.cost;
    btn.onclick = ()=>{ if (S.bolts < part.cost) return; S.bolts -= part.cost;
      mintInstance(part.id); recomputeOwned();
      const fits = tryEquip(type, part.id); saveState();
      showToast(fits ? t("bought", {name:t("pn_"+part.id)}) : t("noRoom"));
      if (!fits) renderHome(); }; }                                  // S16-EDIT : tryEquip rend deja si ok
  card.appendChild(btn);
  return card;
}
// ---- L1: garage strip (active-bot selector + buyable chassis) ----

/* ══ S19 — NOM DE DONNÉE : une seule lecture pour toutes les tables.
   Trois conventions coexistaient (chaîne FR brute pour coques et concours,
   objet {fr,en} pour les séries, clé i18n pour les pièces). dataName accepte
   chaîne OU {fr,en} : les noms propres (RUSTY, FLÈCHE) restent des chaînes —
   un nom propre ne se traduit pas — et tout libellé traduisible passe en
   {fr,en}. Les pièces gardent leurs clés `pn_*`, déjà dans STRINGS. ══ */
function dataName(v, fallback){
  if (v == null) return fallback || "";
  if (typeof v === "string") return v;
  return v[LANG] || v.fr || v.en || fallback || "";
}
/* ══ S18 — SÉRIES : accès DÉRIVÉ, jamais stocké. Une coque sans série
   déclarée retombe sur la série d'origine — aucune orpheline possible. ══ */
function chassisSeriesOf(ch){ return (typeof CHASSIS_SERIE!=="undefined" && CHASSIS_SERIE[ch]) || DEFAULT_SERIES; }
function serieOf(id){ return CHASSIS_SERIES[id] || CHASSIS_SERIES[DEFAULT_SERIES]; }
function serieName(id){ return dataName(serieOf(id).name, id); }
function serieBlurb(id){ return dataName(serieOf(id).blurb, ""); }
function seriesOrdered(){ return Object.values(CHASSIS_SERIES).sort((a,b)=>(a.order||99)-(b.order||99)); }
function chassisName(ch){ return (CHASSIS_INFO[ch]&&CHASSIS_INFO[ch].name)||ch.toUpperCase(); }
function botName(bot){ return da(bot.customName || chassisName(bot.chassis)); }   // E7
function setActiveBot(i){ if(i<0||i>=S.garage.length||i===S.activeBot) return;
  S.activeBot=i; syncActive(); recomputeOwned(); saveState(); renderHome(); }
/* ══ P-FICHE — ÉCHANGE DE BOTS. Une « fiche » est la description PORTABLE d'un
   bot : châssis, définitions de pièces, multiplicités, pilote, placement,
   livrée. Elle ne contient AUCUN uid d'instance (ceux-là appartiennent à une
   carrière), donc elle voyage entre carrières, entre appareils, et entre le
   jeu et le banc de mesure (`node tools/bench.js duel --ficheA <json>`).
   Le placement voyage AVEC : deux bots aux mêmes pièces mais rangées
   autrement n'ont ni le même CG, ni les mêmes colliders, ni les mêmes
   longerons — donc pas le même comportement. Une fiche sans layout ne serait
   pas un build exact. ══ */
const FICHE_V = 1;
function exportBot(bot){
  const b = bot || AB();
  const parts = {}, counts = {};
  for (const sl in ENGINE.PARTS){
    const id = (b.equipped || {})[sl];
    if (!id) continue;                                   // slot vide (optionnel) : absent de la fiche
    parts[sl] = id;
    const n = (b.counts || {})[sl] || 1; if (n > 1) counts[sl] = n;
  }
  return { rc: FICHE_V, chassis: b.chassis, parts, counts,
    pilot: {...(b.pilot || PILOT_DEF)},
    layout: b.layout || null,
    color: (b.customize || {}).color || null,
    stickers: [...((b.customize || {}).placed || [])] };
}
/* importBot — tolérante en ENTRÉE, stricte en SORTIE : tout ce qui n'est pas
   reconnu est écarté en silence, et ce qui sort du garage est toujours un bot
   valide (châssis connu, pièces du bon slot, pilote légal, placement vérifié). */
function importBot(json){
  let f; try { f = typeof json === "string" ? JSON.parse(json) : json; } catch(e){ return null; }
  if (!f || typeof f !== "object" || !f.chassis) return null;
  const chassis = validChassis(f.chassis);
  const bot = bareBot(chassis);
  bot.pilot = validPilot(f.pilot);
  const src = (f.parts && typeof f.parts === "object") ? f.parts : {};
  for (const sl in src){
    const def = src[sl];
    if (!ENGINE.PARTS[sl] || DEF_SLOT[def] !== sl) continue;          // pièce inconnue ou mauvais slot
    const nMax = STACK_SLOTS[sl] ? 3 : 1;
    const n = Math.max(1, Math.min(nMax, ((f.counts || {})[sl] | 0) || 1));
    bot.fit[sl] = []; for (let i = 0; i < n; i++) bot.fit[sl].push(mintInstance(def));
  }
  refit(bot);
  if (typeof f.color === "string") bot.customize.color = f.color;
  if (Array.isArray(f.stickers)) bot.customize.placed = f.stickers.filter(x => x && stickerOf(x.id || x));
  const build = { chassis, parts: {...bot.equipped}, counts: {...bot.counts} };
  bot.layout = (f.layout && layoutValid(build, f.layout)) ? f.layout : autoArrange(build);
  if (bot.layout && bot.layout.__nofit) bot.layout = null;            // rien d'imposable : l'éditeur reprendra
  assignBotId(bot); S.garage.push(bot); S.activeBot = S.garage.length - 1;
  syncActive(); recomputeOwned(); saveState();
  return bot;
}
function buyBot(chassis){ const info=CHASSIS_INFO[chassis]; if(!info) return;
  if(S.bolts < info.cost){ showToast(t("noBolts")); return; }
  S.bolts -= info.cost;
  const bot = bareBot(chassis); refit(bot);             // E7 : châssis neuf = COQUE NUE (garage v2)
  assignBotId(bot); S.garage.push(bot); S.activeBot = S.garage.length-1;
  syncActive(); recomputeOwned(); saveState();
  if (NAV.stack.length > 1) NAV.homeReset();          // acheté depuis la sous-page chassis → retour accueil
  showTab("workshop"); renderHome();
  showBotReceived(chassis, info.name, t("bareHullSub"));                               // E9
  }
/* ══ S17-VIEW — une SEULE verite pour toute representation de bot. Avant,
   chaque site assemblait son build a sa facon (certains sans couleur, sans
   stickers, sans multiplicite) et deux constantes de cadrage coexistaient
   (0,47 editeur / 0,46 vignette) : c'etait ca, le drift. Desormais l'editeur,
   les vignettes du garage, les portraits VS, les carrieres et le bot
   d'occasion passent tous par buildOfBot + BOT_FRAME. ══ */
const BOT_FRAME = 0.47;                      // demi-cadrage commun a TOUTES les vues
/* P-PILOTE / S32 — NORMALISATION A L'ENTREE.
   Le bot STOCKE ses reglages de conduite imbriques (`bot.pilot.handling`), le
   moteur les LIT a plat (`build.handling`, trois sites : actuate, control,
   integrate). buildOfBot ne recopiait ni l'un ni l'autre : tout build passe par
   ici arrivait au moteur SANS pilote, `HANDLING[undefined]` rendait undefined et
   `h.jitter` jetait un TypeError a chaque tick — manche figee, jamais terminee.
   Ni la porte ni le temoin ne le voyaient : genOpponent construit ses builds a
   plat, seul un bot JOUEUR au format sauvegarde traversait ce chemin.
   Une seule forme canonique en sortie d'ici : PLATE. Cle par cle, avec repli sur
   PILOT_DEF, pour qu'une sauvegarde ancienne ou partielle ne puisse pas rouvrir
   le trou. */
function pilotFlat(bot){
  const src = (bot && bot.pilot) || {};
  const out = {};
  for (const k of PILOT_KEYS) out[k] = src[k] ?? bot?.[k] ?? PILOT_DEF[k];
  return out;
}
function buildOfBot(bot){
  return { chassis:bot.chassis,
           parts:{...(bot.equipped||bot.parts||{})},
           counts:{...(bot.counts||{})},
           color:(bot.customize||{}).color || bot.color || null,
           stickers0:(bot.customize||{}).placed || bot.stickers0 || [],
           ...pilotFlat(bot) };
}
function layoutOfBot(bot, build){
  return (bot.layout && layoutValid(build, bot.layout)) ? bot.layout : autoArrange(build);
}
/* S16-GARAGE — la vignette montre le BOT COMPLET (coque + tout ce qui est
   monté), plus la coque nue : au garage on veut reconnaître SON robot.
   `bot` optionnel : si fourni, on dessine son build réel via drawBotTiles ;
   sinon on retombe sur la silhouette de coque (écran d'accueil, boutique). */
function drawBotThumb(ctx, chassis, color, L, bot){ L=L||64; ctx.clearRect(0,0,L,L);
  if (bot){
    try{
      const build=buildOfBot(bot);                       // S17-VIEW : meme build partout
      const lay=layoutOfBot(bot, build);
      ctx.save(); ctx.translate(L/2, L/2);
      const sc=(L*BOT_FRAME)/BOARD_HALF; ctx.scale(sc,sc);   // S17-VIEW : meme cadrage que l'editeur
      drawBotTiles(ctx, build, lay, 0, {shadow:false});
      ctx.restore(); return;
    }catch(e){ ctx.restore && ctx.restore();            // repli : silhouette de coque
      /* S36 — ce repli etait MUET, et son symptome est exactement « un bot sans
         ses pieces ». On a cherche des sprites manquants la ou il y avait
         peut-etre une exception. Le repli reste (une vignette ne casse jamais
         un ecran) mais il PARLE. */
      logError("vignette", "bot " + chassis + " : " + (e && e.message), "app.js", 0); }
  }
  const pad=L*0.92;
  if(chassisSpriteReady(chassis)){
    const img = color ? tintedChassis(chassis,color) : spriteState(chassis).img;
    const s=Math.min(pad/img.width,pad/img.height);
    if(!color) ctx.globalAlpha=0.9;
    ctx.drawImage(img, L/2-img.width*s/2, L/2-img.height*s/2, img.width*s, img.height*s); ctx.globalAlpha=1;
  } else { ctx.fillStyle=color||"#3a4152"; rr(ctx,L*0.16,L*0.16,L*0.68,L*0.68,6); ctx.fill(); }
}
/* S7 — garage nouvelle formule.
   Botstrip : uniquement les bots POSSÉDÉS + une cellule Boutique (on n'achète
   rien au garage). Jeter un bot = deux taps ; les instances montées redeviennent
   libres PAR DÉRIVATION (libre = non référencée), jamais de perte silencieuse ;
   le dernier bot est injetable. */
/* ══ E3b — dégâts appliqués aux INSTANCES du joueur après chaque combat.
   Chocs directs (journal moteur) × fragilité, fatigue vibratoire (somme des
   impulsions), fatigue d'appui (contactT), usure de châssis (réparation
   seule). L'usure ne fait que monter ici ; seule la réparation la descend. ══ */
function slotEff(bot, slot){
  const uids = (bot.fit && bot.fit[slot]) || [];
  if (!uids.length) return 1;
  const ws = uids.map(u => (S.inv.items[u] && S.inv.items[u].wear) || 0);
  const avg = ws.reduce((a,b)=>a+b,0)/ws.length;
  if (avg >= 100) return 0;                                 // HS : contribution nulle
  return 1 - 0.5*Math.max(0, avg-60)/40;                    // mord au-delà de 60 %
}
function buildEff(bot){
  return { motor:slotEff(bot,"motor"), battery:slotEff(bot,"battery"), propulsion:slotEff(bot,"propulsion") };
}
function applyMatchDamage(m){
  const me = m.bots[0], bot = (m.player && botById(m.player.botId)) || AB();   // Phase 2 : dégâts au bot ENGAGÉ
  const rows = [], K = DAMAGE_TUNE;
  const bump = (slot, dw, tag)=>{
    const uids = (bot.fit && bot.fit[slot]) || [];
    for (const u of uids){
      const it = S.inv.items[u]; if (!it) continue;
      const before = it.wear||0;
      it.wear = Math.min(100, Math.round((before + dw)*10)/10);
      if (it.wear > before)
        rows.push({ slot, id:it.def, dw:Math.round(it.wear-before), wear:Math.round(it.wear),
                    hs:it.wear>=100, tag });
    }
  };
  const totJ = me.hits.reduce((a,h)=>a+h.impulse, 0);
  for (const h of me.hits){                                  // chocs directs sur pièce exposée
    if (h.part && FRAGILITY[h.part] != null)
      bump(h.part, h.ripped ? 100 : h.impulse*K.DIRECT_K*FRAGILITY[h.part], h.ripped?"ripped":"direct");
  }
  for (const slot in FRAGILITY){                             // vibrations + fatigue d'appui
    if (!FRAGILITY[slot]) continue;
    const dw = totJ*K.VIB_K*FRAGILITY[slot] + me.contactT*K.GRIND_K*FRAGILITY[slot]*0.1;
    if (dw > 0.05) bump(slot, dw, "vib");
  }
  /* S24-MATIÈRE — l'usure de coque suit la TÉNACITÉ : ce qui encaisse mal se
     répare souvent. Acier (1,00) = comportement historique inchangé. */
  const dch = (totJ*K.CHASSIS_J_K + me.contactT*K.CHASSIS_GRIND_K) / ENGINE.hullOf(bot.chassis);
  bot.chassisWear = Math.min(100, Math.round(((bot.chassisWear||0) + dch)*10)/10);
  // agrégation par pièce (une ligne par instance, cumulée)
  const agg = {};
  for (const r of rows){ const k=r.slot+":"+r.id;
    if(!agg[k]) agg[k]={...r}; else { agg[k].dw+=r.dw; agg[k].wear=r.wear; agg[k].hs=agg[k].hs||r.hs; if(r.tag!=="vib") agg[k].tag=r.tag; } }
  const report = Object.values(agg).filter(r=>r.dw>=1);
  const est = report.reduce((a,r)=>a+repairCostOf(r.slot,r.id,r.dw),0) + Math.round(dch*K.CHASSIS_REPAIR_BASE*K.REPAIR_RATE/100);
  S.lastDamage = { rows:report, chassis:Math.round(dch), chassisWear:bot.chassisWear, est:Math.max(0,Math.round(est)) };
  saveState();
}
function repairCostOf(slot, def, wearAmount){
  const p = ENGINE.partOf(slot, def); if (!p) return 0;
  return Math.ceil(Math.max(DAMAGE_TUNE.REPAIR_FLOOR, (wearAmount/100)*p.cost*DAMAGE_TUNE.REPAIR_RATE));
}
function repairInstance(uid){
  const it = S.inv.items[uid]; if (!it || !(it.wear>0)) return false;
  const cost = repairCostOf(DEF_SLOT[it.def], it.def, it.wear);
  if (S.bolts < cost){ showToast(t("noBolts")); return false; }
  S.bolts -= cost; it.wear = 0; saveState(); renderHome(); return true;
}
function repairChassis(bot){
  const w = bot.chassisWear||0; if (!(w>0)) return false;
  const cost = Math.ceil(Math.max(DAMAGE_TUNE.REPAIR_FLOOR, (w/100)*DAMAGE_TUNE.CHASSIS_REPAIR_BASE*DAMAGE_TUNE.REPAIR_RATE));
  if (S.bolts < cost){ showToast(t("noBolts")); return false; }
  S.bolts -= cost; bot.chassisWear = 0; saveState(); renderHome(); return true;
}
function scrapBot(i){
  if (S.garage.length <= 1){ showToast(t("lastBot")); return false; }
  if (i < 0 || i >= S.garage.length) return false;
  const name = botName(S.garage[i]);
  S.garage.splice(i, 1);                       // ses instances sont libres dès lors qu'aucun fit ne les référence
  if (S.activeBot >= S.garage.length) S.activeBot = S.garage.length - 1;
  else if (i < S.activeBot) S.activeBot--;
  syncActive(); recomputeOwned(); saveState();
  showToast(t("botScrapped", {name}));
  renderHome();
  return true;
}
function renderGarageStrip(){ const el=$("garageStrip"); if(!el) return; el.innerHTML="";
  const head=document.createElement("div"); head.className="rc-section"; head.textContent=t("garageTitle"); el.appendChild(head);
  const strip=document.createElement("div"); strip.className="rc-botstrip";
  S.garage.forEach((bot,i)=>{ const card=document.createElement("div"); card.className="rc-botcell"+(i===S.activeBot?" is-active":"");
    const th=document.createElement("div"); th.className="rc-botcell__thumb";
    const cv = tileCanvas(64, (c)=>drawBotThumb(c, bot.chassis, bot.customize.color, 64, bot));  // S16-GARAGE : bot complet
    th.appendChild(cv); card.appendChild(th);
    const nm=document.createElement("div"); nm.className="rc-botcell__name"; nm.textContent=botName(bot); card.appendChild(nm);
    card.onclick=()=>setActiveBot(i);
    if (i===S.activeBot && S.garage.length>1){
      const sc=document.createElement("button"); sc.className="rc-btn rc-btn--ghost rc-scrap"; sc.textContent=t("scrap");
      sc.onclick=(e)=>{ e.stopPropagation();
        if(!sc._arm){ sc._arm=true; sc.textContent=t("confirmAbandon"); return; }   // deux taps
        scrapBot(i); };
      card.appendChild(sc);
    }
    strip.appendChild(card); });
  const plus=document.createElement("div"); plus.className="rc-botcell rc-botcell--shop";
  plus.innerHTML=`<div class="rc-botcell__thumb" style="background:#130a10;color:var(--rc-amber);font:400 22px var(--rc-f-display);display:flex;align-items:center;justify-content:center">+</div>
    <div class="rc-botcell__name" style="color:var(--rc-amber)">${t("tabShop")}</div>`;
  plus.onclick=()=>showTab("shop");
  strip.appendChild(plus);
  el.appendChild(strip); }
/* Inventaire global visible : instances LIBRES, groupées par pièce, usure min–max. */
function renderInventory(){ const el=$("invStrip"); if(!el) return; el.innerHTML="";
  const head=document.createElement("div"); head.className="rc-section"; head.textContent=t("garageInv"); el.appendChild(head);
  const fm=fittedMap(), byDef={};
  for(const uid in S.inv.items){ if(fm[uid]) continue;
    const it=S.inv.items[uid]; (byDef[it.def]=byDef[it.def]||[]).push(it.wear||0); }
  const defs=Object.keys(byDef).sort((a,b)=>(DEF_SLOT[a]||"").localeCompare(DEF_SLOT[b]||"")||a.localeCompare(b));
  if(!defs.length){ const e=document.createElement("div"); e.className="rc-label"; e.textContent=t("invEmpty"); el.appendChild(e); return; }
  const strip=document.createElement("div"); strip.className="rc-carousel";
  for(const def of defs){
    const ws=byDef[def], slot=DEF_SLOT[def];
    const card=document.createElement("div"); card.className="rc-gcard";
    const art=document.createElement("div"); art.className="rc-gcard__art";
    const cv = tileCanvas(54, (c)=>drawPartTile(c, slot, def, 27, 27, 50, 44, 0, 1));
    art.appendChild(cv); card.appendChild(art);
    const nm=document.createElement("div"); nm.className="rc-gcard__name"; nm.textContent=t("pn_"+def)+(ws.length>1?" \u00D7"+ws.length:""); card.appendChild(nm);
    const wmin=Math.min(...ws), wmax=Math.max(...ws);
    const fx=document.createElement("div"); fx.className="rc-gcard__fx";
    fx.textContent = wmax>0 ? t("usedWear", {w: wmin===wmax? wmin : wmin+"\u2013"+wmax}) : t("invNew");
    card.appendChild(fx);
    strip.appendChild(card);
  }
  el.appendChild(strip); }
/* Châssis À VENDRE : déménagés en boutique (le garage ne vend rien). */
function renderChassisScreen(){ const el=$("chassisList"); if(!el) return; el.innerHTML="";
  { const cr=$("chassisCrumbRoot"); if(cr){ cr.textContent=da(t("tabShop")); cr.className="crumb-link"; cr.onclick=()=>NAV.uiBack(); }
    const hc=$("chassisCrumbHere"); if(hc) hc.textContent=da(t("shopChassis")); }
  /* S18 — l'étal est organisé PAR SÉRIE, puis par classe (E5). Avec une seule
     série aujourd'hui, l'en-tête sert de bandeau de gamme ; le jour où le
     marchand en tiendra plusieurs, l'étal les accueille sans une ligne de
     code de plus — les coques déclarent leur série, c'est tout. */
  const bySerie = {};
  for(const ch of BUYABLE_CHASSIS){
    const sid = chassisSeriesOf(ch);
    ((bySerie[sid] ||= {})[chassisClassOf(ch)] ||= []).push(ch); }
  for(const s of seriesOrdered()){
  const byClass = bySerie[s.id]; if(!byClass) continue;
  { const sh=document.createElement("div"); sh.className="rc-serie";
    sh.style.setProperty("--serie-accent", s.accent || "var(--rc-amber)");   // S19 : variable CSS, pas de couleur en dur
    const n=document.createElement("div"); n.className="rc-serie__name";
    n.textContent = da(t("shopSerie")) + " \u00B7 " + da(serieName(s.id));
    const b=document.createElement("div"); b.className="rc-serie__blurb";
    b.textContent = serieBlurb(s.id);
    sh.append(n,b); el.appendChild(sh); }
  for(const cls of ["S","M","L","XXL"]){
    if(!byClass[cls]) continue;
    const head=document.createElement("div"); head.className="rc-section";
    head.textContent=t("shopChassis")+" \u00B7 "+t("classe")+" "+cls; el.appendChild(head);
    const strip=document.createElement("div"); strip.className="rc-botstrip rc-botstrip--big";
    for(const ch of byClass[cls]){ const info=CHASSIS_INFO[ch];
      const card=document.createElement("div"); card.className="rc-botcell rc-botcell--big"+(S.bolts<info.cost?" cant":"");
      const th=document.createElement("div"); th.className="rc-botcell__thumb rc-botcell__thumb--big"; th.style.position="relative";
      const cv = tileCanvas(128, (c)=>drawChassisShopTile(c, ch, 128, cls));   // fond de classe (S=tapis vert) + coque 20% plus petite
      th.appendChild(cv);
      { const cb=document.createElement("div"); cb.textContent=cls;   // pastille de classe
        cb.style.cssText="position:absolute;left:3px;top:3px;font:700 10px var(--rc-f-mono,monospace);color:#0a080c;background:"+(CLASS_COLORS[cls]||"#888")+";padding:0 5px;border-radius:3px;line-height:15px";
        th.appendChild(cb); }
      card.appendChild(th);
      const nm=document.createElement("div"); nm.className="rc-botcell__name"; nm.textContent=info.name; card.appendChild(nm);
      const pr=document.createElement("div"); pr.className="botprice"; pr.innerHTML=BOLT_SVG+" "+info.cost; card.appendChild(pr);
      card.onclick=()=>buyBot(ch); strip.appendChild(card); }
    el.appendChild(strip); }
  }                                                    // S18 : fin de boucle de série
  }
function renderChassisShop(){ const el=$("chassisShop"); if(!el) return; el.innerHTML="";
  // S20-CHASSIS — bandeau UNIQUE ; l'étal complet vit dans renderChassisScreen (sous-page).
  const a=document.createElement("div"); a.className="rc-league"; a.style.cursor="pointer";
  a.innerHTML = '<div class="rc-league__crest" style="color:var(--rc-violet-lt)">◈</div>'
    + '<div class="rc-league__body"><div class="rc-league__name">'+da(t("shopChassis"))+'</div>'
    + '<div class="rc-league__meta">'+da(t("shopChassisAll"))+'</div></div>'
    + '<div class="rc-league__side">'+t("enter")+'</div>';
  a.onclick = ()=>{ NAV.push("chassisScreen"); renderChassisScreen(); };
  el.appendChild(a);
}
function drawChassisShopTile(ctx, chassis, L, cls){
  L=L||128; ctx.clearRect(0,0,L,L);
  if (cls==="S"){ const bg=mkImg("assets/bg_s_mat.webp");            // fond tapis de découpe vert (classe S)
    if (bg && bg.complete && bg.naturalWidth>0){ const s=Math.max(L/bg.naturalWidth, L/bg.naturalHeight);
      const w=bg.naturalWidth*s, h=bg.naturalHeight*s; ctx.save(); ctx.globalAlpha=0.95; ctx.drawImage(bg,(L-w)/2,(L-h)/2,w,h); ctx.restore(); } }
  const pad=L*0.92*0.8;                                              // coque 20% plus petite qu'au garage
  if (chassisSpriteReady(chassis)){ const img=spriteState(chassis).img;
    const s=Math.min(pad/img.width,pad/img.height);
    ctx.drawImage(img, L/2-img.width*s/2, L/2-img.height*s/2, img.width*s, img.height*s);
  } else { ctx.fillStyle="#3a4152"; rr(ctx,L*0.16,L*0.16,L*0.68,L*0.68,6); ctx.fill(); }
}
// ---- L2: tournaments — generic scrutineering (rules) + format-extensible data ----
const CLASS_BANDS = TIER_BY_ID.beetle.classBands; // alias rétro-compat — la vérité vit dans TIERS
function chassisCells(ch){ let n=0; for(let r=0;r<gridH(ch);r++)for(let c=0;c<gridW(ch);c++) if(cellInChassis(ch,c,r)) n++; return n; }
function chassisClassOf(ch){ const n=chassisCells(ch); for(const [cl,mx] of tierOf(ch).classBands) if(n<=mx) return cl; return "XXL"; }
function equipKg(build){ return ENGINE.physStats(build).massKg - ENGINE.PHYS.chassis[build.chassis].kg; }
// generic metric table: add a cap type in ONE line, no per-metric validator code
const METRICS = {
  equipKg:  { get:b=>equipKg(b),                  label:"Poids équip.", unit:"kg", dp:2 },
  weightKg: { get:b=>ENGINE.physStats(b).massKg,  label:"Poids total",  unit:"kg", dp:2 },
  motorKw:  { get:b=>ENGINE.physStats(b).powerKW, label:"Puissance",    unit:"kW", dp:2 },
  batteryWh:{ get:b=>ENGINE.physStats(b).packWh,  label:"Batterie",     unit:"Wh", dp:1 },
  torqueNm: { get:b=>ENGINE.physStats(b).torqueNm,label:"Couple",       unit:"Nm", dp:2 },
};
/* S29 — le palier logiciel s'AFFICHE v0..v3, et l'id reste s0..s3 (taxonomie
   gelée). Les libellés disaient « Firmware v1 » pour s0 : un décalage de un
   qui rendait « v3 » ambigu au moment d'ajouter l'arbitrage. Le numéro
   affiché EST désormais l'indice. */
function swTier(id){ return ENGINE.PARTS.software.findIndex(p=>p.id===id); }
// validate a build against a tournament's rules → {ok, fails:[msg]}
function checkEntry(build, rules){
  { const fc = functionalCheck(build);                                    // E7 : CT avant les règles
    if (!fc.ok) return { ok:false, fails: fc.fails }; }
  const fails=[], r=rules||{}, pr=build.parts||{};
  if(r.chassisClass && chassisClassOf(build.chassis)!==r.chassisClass)
    fails.push(t("scrClass",{c:r.chassisClass, got:chassisClassOf(build.chassis)}));
  if(r.tier && tierOf(build.chassis).id !== r.tier)
    fails.push(t("scrTier",{tr:(TIER_BY_ID[r.tier]||{name:r.tier}).name}));
  if(r.maxCount) for(const sl in r.maxCount){ const n=(build.counts&&build.counts[sl])||1;
    if(n > r.maxCount[sl]) fails.push(t("scrCount",{p:t("pn_"+(pr[sl]||ENGINE.PARTS[sl][0].id)), n, c:r.maxCount[sl]})); }
  if(r.banTracks && pr.propulsion==="pr3") fails.push(t("scrTracks"));
  if(r.banWeapons && ((pr.weapon1&&pr.weapon1!=="w0")||(pr.weapon2&&pr.weapon2!=="x0"))) fails.push(t("scrWeapons"));
  if(r.banComponents) for(const id of r.banComponents)
    if(Object.values(pr).includes(id)) fails.push(t("scrBanned",{p:t("pn_"+id)}));
  if(r.maxSoftware && swTier(pr.software||"s0") > swTier(r.maxSoftware))
    fails.push(t("scrSoftware",{v:swTier(r.maxSoftware)}));
  if(r.metrics) for(const key in r.metrics){ const m=METRICS[key]; if(!m) continue;
    const val=m.get(build), cap=r.metrics[key];
    if(val > cap+1e-6) fails.push(t("scrMetric",{m:m.label, v:val.toFixed(m.dp), c:(+cap).toFixed(m.dp), u:m.unit})); }
  return { ok:fails.length===0, fails };
}
// catalogue des concours (extensible par format : ladder, championnat, coupe)
/* B2 — une épreuve = deux axes (palier, classe) + un format + des règles, tout en
   données. NOTE chantier D : pas de plafond de masse automatique au palier tant que
   l'économie n'est pas recalée (le bot de départ pèse 1,38 kg > 1,36 officiel). */
/* TOURNAMENTS et LIGUES vivent dans data.js (principe 1 : les règles sont des
   données ; ajouter une ligue ou un concours = une entrée, zéro code).
   ---- S3 : hiérarchie Ligue → Concours → Manche. API d'engagement. ---- */
const MODE_CONCOURS = { bracket:"cupM", championnat:"lightM" };   // mode de combat → concours (transitoire, les écrans S5+ passeront l'id)
const CN = id => (S.concours || {})[id] || null;                  // état de progression d'un concours engagé
function tournamentById(id){ return TOURNAMENTS.find(x => x.id === id) || null; }
function ligueById(id){ return LIGUES.find(l => l.id === id) || null; }
/* unlock déclaratif (décision 3a) : null = ouvert ; {placeholder:true} = jamais
   (« bientôt ») ; {level:n} = niveau d'échelle ; {concoursDone:id} = avoir mené
   ce concours à son terme. Ajouter une condition = un champ ici, une entrée là-bas. */
/* ══ S25-ÉTOILES — le palmarès devient la clé du contenu.
   Barème unique (décision Denis) : 1re place ★★★ · 2e ★★ · 3e ★. On garde le
   MEILLEUR résultat par épreuve, jamais de perte.

   Chaîne de déblocage, jamais punitive :
     — épreuve suivante d'une ligue : ≥ 1★ dans CHAQUE épreuve précédente ;
     — ligue suivante : ≥ 1★ dans CHAQUE épreuve de la ligue courante.
   Les déblocages sont DÉRIVÉS de S.stars à chaque rendu, jamais stockés :
   une seule source, et rien à migrer si le barème bouge.

   `noStars:true` sort une épreuve du barème ET de la chaîne — le combat libre
   (exhibition) et les étalons de Calibrage mesurent, ils ne récompensent pas. */
const starsOf = (cid) => ((S.stars || {})[cid] | 0);
const STARS_FOR_RANK = { 1:3, 2:2, 3:1 };
function awardStars(cid, rank){
  const n = STARS_FOR_RANK[rank] || 0;
  if (!n) return 0;
  S.stars = S.stars || {};
  if (n <= starsOf(cid)) return 0;                       // le meilleur résultat prime
  S.stars[cid] = n;
  return n;
}
/* Le rang d'une épreuve terminée, par FORMAT. C'est la seule chose qui diffère
   d'un format à l'autre — le barème, lui, est unique. */
function rankOfBracket(bk){
  if (!bk) return 0;
  if (!bk.out && bk.round >= bk.rounds) return 1;        // champion
  if (bk.round === bk.rounds - 1) return 2;              // battu en finale
  if (bk.round === bk.rounds - 2) return 3;              // battu en demi
  return 0;
}
/* Échelle (sumoM) : pas de podium — barème de PROGRESSION. Le niveau atteint
   vaut le rang, et on le décerne à chaque montée, pas seulement à la fin. */
function rankOfLadder(level, champion){
  if (champion) return 1;
  if (level >= 4) return 2;
  if (level >= 3) return 3;
  return 0;
}
const starConcours = (lg) => lg.concours.filter(id => { const tr = tournamentById(id); return tr && !tr.noStars; });
const ligueOfConcours = (cid) => LIGUES.find(l => l.concours.includes(cid)) || null;
const ligueComplete = (lg) => !!lg && starConcours(lg).every(id => starsOf(id) >= 1);
/* Une ligue est ouverte si toutes celles qui la PRÉCÈDENT dans LIGUES et qui
   comptent des étoiles sont complètes. L'ordre du tableau EST la progression. */
function ligueUnlocked(lg){
  if (!lg) return false;
  if (lg.unlock && lg.unlock.placeholder) return false;
  if (lg.noStars) return true;                            // Calibrage : toujours ouverte
  for (const l of LIGUES){
    if (l.id === lg.id) break;
    if (l.noStars || (l.unlock && l.unlock.placeholder)) continue;
    if (!ligueComplete(l)) return false;
  }
  return true;
}
function concoursUnlocked(cid){
  const tr = tournamentById(cid); if (!tr) return false;
  const lg = ligueOfConcours(cid);
  if (!lg) return unlockMet(tr.unlock);                   // hors ligue : règle déclarative
  if (!ligueUnlocked(lg)) return false;
  if (tr.noStars) return true;
  const chain = starConcours(lg);
  for (const id of chain){ if (id === cid) break;
    if (starsOf(id) < 1) return false; }
  return true;
}
/* Le seuil MANQUANT, en clair : « 1★ en Coupe des Puces pour ouvrir… ». Un
   verrou qu'on ne sait pas ouvrir est un verrou qui n'existe pas. */
function missingStarFor(cid){
  const tr = tournamentById(cid), lg = ligueOfConcours(cid);
  if (!tr || !lg || tr.noStars) return null;
  if (!ligueUnlocked(lg)){
    for (const l of LIGUES){
      if (l.id === lg.id) break;
      if (l.noStars || (l.unlock && l.unlock.placeholder)) continue;
      const manque = starConcours(l).filter(id => starsOf(id) < 1);
      if (manque.length) return { ligue:l, concours:manque };
    }
    return null;
  }
  const manque = starConcours(lg).filter(id => { if (id === cid) return false;
    return starConcours(lg).indexOf(id) < starConcours(lg).indexOf(cid) && starsOf(id) < 1; });
  return manque.length ? { ligue:lg, concours:manque } : null;
}
function unlockMet(u){
  if (!u) return true;
  if (u.placeholder) return false;
  if (u.level != null && S.level < u.level) return false;
  if (u.concoursDone && !S.concoursDone[u.concoursDone]) return false;
  if (u.beaten != null && S.beaten < u.beaten) return false;   // E1 : porte de palmarès
  return true;
}
/* E1 — bourse ×ligue : toute prime de concours est multipliée par le
   purseMult de sa ligue (données). Le combat isolé (libre/qualif) reste ×1. */
function purseMult(concoursId){
  /* CALIBRAGE : purseMult 0 est une VALEUR (mesure sans bourse), pas une
     absence — `|| 1` la transformait silencieusement en bourse pleine. */
  for (const lg of LIGUES) if (lg.concours.includes(concoursId)) return lg.purseMult ?? 1;
  return 1;
}
function snapshotBuild(){                                          // gel du build à l'engagement
  const bot = AB();
  const b = { chassis:bot.chassis, parts:{...S.parts.equipped}, counts:{...bot.counts} };
  return { ...b, botId: bot.botId,                                // Phase 2 : le bot ENGAGÉ est identifié
    color:S.customize.color, stickers:[...S.customize.placed],
    layout: layoutOfBot(bot, b) };                               // P1-a : la VRAIE mise en page validée, pas autoArrange
}
/* Phase 2 — AUTO-RÉPARATION d'un verrou CASSÉ. Une sauvegarde antérieure à
   l'identité stable gelait un lock SANS botId (`undefined`), ou le bot engagé a
   été jeté depuis : le combat rejouait alors un build fantôme (auto-arrangé,
   figé), l'éditeur montrant le vrai bot. On NE re-gèle QUE dans ce cas (choix :
   self-heal des verrous cassés uniquement) — le build gelé est resynchronisé
   sur le bot actif ; un verrou sain reste intouché (gel à l'engagement). */
function healBrokenLock(concoursId){
  const st = concoursId ? CN(concoursId) : null;
  const lock = st && st.lock;
  if (lock && !botById(lock.botId)){
    logError("match", "verrou cassé (botId "+lock.botId+") → resynchronisé sur l'actif", "app.js", 0);
    st.lock = snapshotBuild(); saveState();
    return st.lock;
  }
  return lock || null;
}
/* engageConcours — l'engagement est un acte explicite et nommé (jamais un effet
   de bord d'un clic). Vérifie déverrouillage + homologation, initialise l'état
   du format, gèle le build si le concours le déclare (lockBuild). */
function engageConcours(id){
  curVsConcours = id;                                            // E4
  const tr = tournamentById(id);
  if (!tr) return { ok:false, fails:["?"] };
  if (CN(id)) return { ok:false, fails:[], already:true };
  if (!concoursUnlocked(id)){
    const msg = (tr.unlock && tr.unlock.beaten != null)
      ? t("lockBeaten", {n: tr.unlock.beaten}) + " (" + S.beaten + "/" + tr.unlock.beaten + ")"
      : t("soon");
    return { ok:false, fails:[msg], locked:true };
  }
  const myBuild = { chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts} };
  myBuild.beamCells = beamCellsOf(myBuild, getLayout());                       // S16-WHEELS : la pesee compte les longerons
  myBuild.eff = buildEff(AB());                                               // P0-1 : le CT refuse un organe vital HS
  const chk = checkEntry(myBuild, tr.rules);
  if (!chk.ok) return chk;
  const st = FORMATS[tr.format].init(Math.floor(Math.random()*1e9), tr.format==="bracket" ? tr.size : tr.rounds);
  if (tr.lockBuild) st.lock = snapshotBuild();
  S.concours[id] = st; saveState();
  return { ok:true };
}
function abandonConcours(id){                                      // décision 2b : progression perdue, zéro malus
  if (!CN(id)) return false;
  delete S.concours[id]; saveState(); return true;
}
// format engines: encapsulate a competition's state transitions (ladder wired; championnat/coupe)
const FORMATS = {
  ladder: {
    // advance ladder state on a tournament match result; returns a UI descriptor (no DOM here)
    tourResult(realWin, w){
      if(!S.tourney) return {kind:"lost"};                     // S16-CRASH : échelle déjà consommée
      if(realWin){
        if(S.tourney.idx < 2){ S.tourney.idx++; return {kind:"next", i:S.tourney.idx+1}; }
        const prize = Math.round(w*5*purseMult("sumoM")); S.bolts += prize;   // E1 : bourse ×ligue
        if(!S.badges.includes(S.level)) S.badges.push(S.level);
        let champion=false;
        if(S.level >= 5){ S.champion=true; champion=true; } else { S.level++; }
        /* S25 — l'échelle n'a pas de podium : le NIVEAU ATTEINT fait le rang,
           décerné à chaque montée et pas seulement au sommet. */
        awardStars("sumoM", rankOfLadder(S.level, champion));
        S.tourney=null; S.beatenAtLevel=0; S.opponent=null;
        return {kind:"won", prize, champion};
      }
      S.tourney.fails = (S.tourney.fails||0) + 1;
      if(S.tourney.fails >= 4){ S.tourney=null; return {kind:"reroll"}; }
      S.tourney.idx = 0; return {kind:"lost"};
    }
  },
  // 10 rounds, ranked by average score vs a seeded field of rivals. You need to place, not sweep.
  championnat: {
    /* S16-RANK — round-robin HONNÊTE (retrade playtest 25/07) :
       - participants = manches + 1 : on affronte chaque rival UNE fois
         (sumoS 4 manches = 5 places, sparS 6 = 7, lightM 10 = 11) ;
       - le score du joueur suit le RÉSULTAT du match (victoire 2, défaite
         combative 1 si au moins un duel gagné, sinon 0) — plus jamais les
         duels de levier seuls (une sortie de piste éclair valait 0 point) ;
       - le rival affronté cette manche encaisse le résultat inverse (te
         battre lui refuse ses points) ; les autres jouent entre eux (tirage
         par force, inchangé). */
    RIVALS: ["MAXIMUS","VORTEX","BRUTUS","NOVA","TITAN","RAZOR","CINDER","JOLT","PISTON","GRIND"],
    _rng(seed){ let a=(seed>>>0)||1; return ()=>{ a=(a*1664525+1013904223)>>>0; return a/4294967296; }; },
    init(seed, rounds){ const rng=this._rng(seed); const n=Math.min(rounds||10, this.RIVALS.length);
      const rivals=this.RIVALS.slice(0,n).map(nm=>({name:nm, strength:0.35+rng()*0.5, score:0}));
      return { format:"championnat", round:0, rounds:rounds||10, myScore:0, rivals }; },
    faced(lg){ return lg.rivals[lg.round % lg.rivals.length]; },
    // record your match. realWin optionnel (compat harness) : dérivé des duels si absent.
    recordMatch(lg, myDuels, realWin){
      const won = (realWin === undefined) ? (myDuels|0) >= 2 : !!realWin;
      lg.myScore += won ? 2 : ((myDuels|0) >= 1 ? 1 : 0);
      const me = this.faced(lg);
      const rng=this._rng((lg.round+1)*7919);
      for(const r of lg.rivals){
        if (r === me){ r.score += won ? 0 : 2; continue; }        // ton adversaire encaisse TON résultat
        r.score += (rng()<r.strength ? 2 : (rng()<0.5?1:0));
      }
      lg.round++; return lg.round >= lg.rounds; },
    standings(lg){ const all=[{name:"VOUS",score:lg.myScore,me:true}, ...lg.rivals.map(r=>({name:r.name,score:r.score}))];
      all.sort((a,b)=> b.score-a.score || (a.me?-1:b.me?1:0));
      return all.map((e,i)=>({ ...e, rank:i+1, avg:(e.score/Math.max(1,lg.round)) })); },
    myRank(lg){ const e=this.standings(lg).find(x=>x.me); return e?e.rank:0; },
    isDone(lg){ return lg.round >= lg.rounds; },
    prize(lg, w){ const rank=this.myRank(lg);
      const part = Math.ceil(w*1.5);                                  // participation — guaranteed after 10 bouts
      const podium = rank===1 ? w*4 : rank===2 ? w*2 : rank===3 ? w : 0;
      return { rank, part, podium, total: part+podium }; }
  },
  // 16-entrant elimination tree. Build is LOCKED at entry; only pilot params change between bouts.
  bracket: {
    NAMES: ["MAXIMUS","VORTEX","BRUTUS","NOVA","TITAN","RAZOR","CINDER","JOLT","HAVOC","ONYX","FANG","BOLT","KRUSH","VIPER","ZENITH"],
    _rng(seed){ let a=(seed>>>0)||1; return ()=>{ a=(a*1664525+1013904223)>>>0; return a/4294967296; }; },
    init(seed, size){ const rng=this._rng(seed);
      /* P1-b — la taille est une DONNÉE du concours (tr.size). On valide qu'elle
         est une puissance de deux ≥2 ; le champ de rivaux est plafonné par NAMES. */
      let n = size|0;
      if (!(n>=2) || (n & (n-1))){ logError("bracket","taille "+size+" invalide → 16","app.js",0); n=16; }
      n = Math.min(n, this.NAMES.length+1);
      const ents=[{name:"VOUS", me:true, strength:0.5}];
      const names=this.NAMES.slice(); // shuffle rivals into the field
      for(let i=names.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [names[i],names[j]]=[names[j],names[i]]; }
      for(let i=0;i<n-1;i++) ents.push({ name:names[i], strength:0.3+rng()*0.55 });
      return { format:"bracket", seed, size:n, round:0, rounds:Math.log2(n), out:false, current: ents, path:[ents.slice()] }; },
    myOpponent(bk){ return bk.current[1]; },                          // you are always slot 0 of the live round
    recordMatch(bk, iWon){
      const parts=bk.current, winners=[];
      winners.push(iWon ? parts[0] : parts[1]);                       // your pair (0,1)
      if(!iWon) bk.out=true; else bk.round++;
      const rng=this._rng((bk.seed^((bk.path.length)*104729))>>>0);
      for(let i=2;i<parts.length;i+=2){ const a=parts[i], b=parts[i+1];
        winners.push(rng() < a.strength/(a.strength+b.strength) ? a : b); }
      bk.current=winners; bk.path.push(winners.slice());
      return this.isDone(bk); },
    isDone(bk){ return bk.out || bk.round>=bk.rounds; },
    roundName(bk){ const rem=(bk.size||16)>>bk.round;                 // P1-b : dérivé de la taille
      return rem<=2?"Finale":rem===4?"Demi":rem===8?"Quarts":(rem/2)+"es"; },
    prize(bk, w){ const r=bk.round, champ=!bk.out && r>=bk.rounds;
      const total=[w, w*2, w*3, w*5, w*8][Math.min(4,r)];
      return { round:r, champ, total }; }
  }
};
function rulesSummary(r){ const p=[];
  if(r.chassisClass) p.push("Classe "+r.chassisClass);
  if(r.banWeapons) p.push(t("scrWeapons"));
  if(r.banTracks) p.push(t("scrTracks"));
  if(r.maxSoftware) p.push(t("scrSoftware",{v:swTier(r.maxSoftware)}));
  if(r.metrics) for(const k in r.metrics){ const m=METRICS[k]; if(m) p.push("\u2264 "+r.metrics[k]+" "+m.unit); }
  return p.join(" \u00B7 ") || t("unlimited"); }
function formatLabel(tr){                        // E5b : le libellé lit les DONNÉES du concours
  if (tr.format === "championnat") return "Championnat \u00B7 " + (tr.rounds||10) + " manches";
  if (tr.format === "bracket")     return "Coupe \u00B7 arbre " + (tr.size||16);
  if (tr.format === "ladder")      return "Ladder \u00B7 " + (tr.levels||5) + " niveaux";
  return "Exhibition \u00B7 1 manche";
}
function enterBracket(){
  if (!CN("cupM")){ const r = engageConcours("cupM"); if (!r.ok){ showToast(r.fails[0] || t("soon")); return; } }
  curVsConcours = "cupM";
  startMatch("bracket");
}
function enterChampionnat(){
  if (!CN("lightM")){ const r = engageConcours("lightM"); if (!r.ok){ showToast(r.fails[0] || t("soon")); return; } }
  curVsConcours = "lightM";                                     // E4 : flux générique par id
  startMatch("championnat");
}
function renderBracketView(id, elArg){ const el=elArg||$("bracketView"); if(!el) return;   // E4 : générique par id ; S38-HUB : cible optionnelle
  id = id || "cupM";
  if(!S.concours[id]){ el.style.display="none"; el.innerHTML=""; return; }
  const bk=S.concours[id]; el.style.display="block"; el.innerHTML="";
  const head=document.createElement("div"); head.className="persohead";
  head.textContent=t("bracketTitle")+" \u00B7 "+(FORMATS.bracket.isDone(bk)?t("bracketDone"):FORMATS.bracket.roundName(bk)); el.appendChild(head);
  const wrap=document.createElement("div"); wrap.className="bkcols";
  const labels=["16es","Quarts","Demi","Finale","\uD83C\uDFC6"];
  const totalCols = FORMATS.bracket.isDone(bk) ? bk.path.length : ((bk.rounds||4)+1);   // P1-b : colonnes = tours+1
  for(let ci=0; ci<totalCols; ci++){
    const col=document.createElement("div"); col.className="bkcol";
    const cl=document.createElement("div"); cl.className="bklabel"; cl.textContent=labels[ci]||""; col.appendChild(cl);
    const rnd = bk.path[ci];
    if(rnd){ rnd.forEach(e=>{ const cell=document.createElement("div"); cell.className="bkcell"+(e.me?" me":""); cell.textContent=e.me?t("you"):e.name; col.appendChild(cell); }); }
    else { const n=Math.max(1, 16>>ci); for(let k=0;k<n;k++){ const cell=document.createElement("div"); cell.className="bkcell future"; cell.textContent="?"; col.appendChild(cell); } }
    wrap.appendChild(col); }
  el.appendChild(wrap); }
function renderChampStandings(id, elArg){ const el=elArg||$("champStandings"); if(!el) return; // E4 : générique par id ; S38-HUB : cible optionnelle
  id = id || "lightM";
  const cst = S.concours[id];
  if(!cst){ el.style.display="none"; el.innerHTML=""; return; }
  el.style.display="block"; el.innerHTML="";
  const head=document.createElement("div"); head.className="persohead";
  head.textContent=t("champTable")+" \u00B7 "+t("champRound",{r:Math.min(cst.round+1,cst.rounds), n:cst.rounds, rank:FORMATS.championnat.myRank(cst)});
  el.appendChild(head);
  const tbl=document.createElement("table"); tbl.className="lgtable";
  for(const e of FORMATS.championnat.standings(cst)){
    const tr=document.createElement("tr"); tr.className=(e.me?"me ":"")+(e.rank<=3?"podium":"");
    tr.innerHTML=`<td class="rk">${e.rank}</td><td>${e.me?t("you"):e.name}</td><td class="sc">${e.score} · ${e.avg.toFixed(2)}</td>`;
    tbl.appendChild(tr);
  }
  el.appendChild(tbl); }
/* ═══ S5 — Écrans Championnats ═══
   A (renderLigues, dans l'onglet) : bannières de ligue — niveau, contenu,
   engagements en cours, verrouillage déclaratif.
   B (renderLigueScreen, empilé sur NAV) : les concours d'une ligue —
   format, règles, éligibilité détaillée, engagement EXPLICITE, suivi,
   abandon (deux taps), et lancement de la manche. */
let curLigue = null;
function concoursProgress(tr){                       // vue uniforme de progression
  const st = CN(tr.id);
  if (tr.format === "ladder")
    return (S.level >= 5 && S.champion) ? t("champion")+" 🏆"
         : t("level")+" "+S.level+" · "+"●".repeat(S.beatenAtLevel)+"○".repeat(Math.max(0,2-S.beatenAtLevel));
  if (!st) return null;
  if (tr.format === "championnat")
    return t("champRound", {r:Math.min(st.round+1,st.rounds), n:st.rounds, rank:FORMATS.championnat.myRank(st)});
  if (tr.format === "bracket")
    return FORMATS.bracket.isDone(st) ? t("bracketDone") : FORMATS.bracket.roundName(st);
  return t("enCours");
}
function renderLigues(){
  const el = $("liguesList"); if(!el) return; el.innerHTML = "";
  for (const lg of LIGUES){
    const open = ligueUnlocked(lg);                              // S25 : dérivé des étoiles
    const chain = starConcours(lg);
    const gagnees = chain.reduce((n, id) => n + starsOf(id), 0), total = chain.length * 3;
    const a = document.createElement("div");
    a.className = "rc-league" + (open ? " is-open" : " is-locked");
    const nEng = lg.concours.filter(id => CN(id)).length;
    const meta = open
      ? t("nConcours", {n:lg.concours.length}) + (nEng ? " · " + t("kEnCours", {k:nEng}) : "")
        + (chain.length ? " · \u2605 " + gagnees + "/" + total : "")
      : (chain.length ? t("lockStars") : t("soon"));
    a.innerHTML = `<div class="rc-league__crest"${open?' style="color:var(--rc-violet-lt)"':''}>${open?"◈":"🔒"}</div>
      <div class="rc-league__body"><div class="rc-league__name">${da(dataName(lg.name))}</div>
      <div class="rc-league__meta">${meta}</div></div>
      <div class="rc-league__side">${open ? t("enter") : t("lockedTag")}</div>`;
    if (open) a.onclick = ()=>{ curLigue = lg.id; NAV.push("ligueScreen"); renderLigueScreen(); };
    el.appendChild(a);
  }
}
function modeForConcours(id){
  const tr = tournamentById(id); if(!tr) return "exhib";
  if (tr.format === "bracket") return "bracket";
  if (tr.format === "championnat") return "championnat";
  if (tr.format === "ladder") return tournamentOpen() ? "tour" : "qual";
  return "exhib";
}
function disputeConcours(id){                       // ouvre l'écran VS de la manche
  /* S20-SCRUTIN — homologation à la DISPUTE pour les épreuves sans acte
     d'engagement (noEngage : échelle sumoM, combat libre). Elles n'avaient
     jamais rencontré checkEntry : la pesée (5,44 kg) et la multiplicité
     (motor ≤ 3) de l'échelle M étaient décoratives. Quand un engagement
     existe, l'homologation a déjà eu lieu à l'engagement et le build est gelé
     s'il doit l'être : on ne re-juge pas. */
  const tr0 = tournamentById(id);
  const live = {chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}};
  live.beamCells = beamCellsOf(live, getLayout());                        // la pesée compte les longerons
  if (tr0 && !CN(id)){
    const chk = checkEntry(live, tr0.rules);                              // E7 : CT incluse
    if (!chk.ok){ showToast(chk.fails[0]); return; }
  } else {
    const fc = functionalCheck(live);
    if (!fc.ok){ showToast(fc.fails[0]); return; }                        // E7 : CT
  }
  curVsConcours = id;
  vsMode = modeForConcours(id);
  vsOpp = makeOpponent(vsMode);
  NAV.push("vsScreen");
  renderVsScreen();
}
function vsMancheLabel(tr){
  const st = CN(tr.id);
  if (tr.format === "championnat" && st) return t("mancheN", {r:Math.min(st.round+1,st.rounds), n:st.rounds});
  if (tr.format === "bracket" && st) return FORMATS.bracket.roundName(st);
  if (tr.format === "ladder") return tournamentOpen() ? t("tourneyTitle", {l:S.level, i:S.tourney?S.tourney.idx+1:1}) : t("vsQual");
  return t("vsExhib");
}
function renderVsScreen(){
  const tr = tournamentById(curVsConcours); if(!tr || !vsOpp) return;
  const lg = ligueById(curLigue);
  $("vsCrumbLigue").textContent = da(lg ? dataName(lg.name) : t("tabFight"));
  $("vsCrumbLigue").className = "crumb-link";
  $("vsCrumbLigue").onclick = ()=>NAV.uiBack();
  $("vsCrumbConcours").textContent = da(dataName(tr.name));
  $("vsCrumbConcours").className = "crumb-link";
  $("vsCrumbConcours").onclick = ()=>NAV.uiBack();
  $("vsCrumbManche").textContent = vsMancheLabel(tr);
  $("vsFormat").textContent = formatLabel(tr).toUpperCase();
  $("vsManche").textContent = vsMancheLabel(tr);
  /* S38-HUB — l'écran VS EST le hub du championnat : classement (championnat) ou
     tableau (coupe) juste sous le titre, pour suivre sa progression manche après
     manche. Vide pour les formats sans suivi (échelle, libre). */
  { const hub=$("vsStandings");
    if (tr.format==="championnat") renderChampStandings(tr.id, hub);
    else if (tr.format==="bracket") renderBracketView(tr.id, hub);
    else if (hub){ hub.style.display="none"; hub.innerHTML=""; } }
  // mon bot — celui qui combattra VRAIMENT : le build gelé si le concours gèle
  const lock = healBrokenLock(tr.id);   // verrou cassé (save ancienne) → resync sur l'actif, sinon le portrait montre un fantôme
  const myBuild = {...PILOT(),
    chassis: lock ? lock.chassis : AB().chassis,
    parts: {...(lock ? lock.parts : S.parts.equipped)},
    counts: {...(lock ? (lock.counts||{}) : AB().counts)},
    color: lock ? lock.color : S.customize.color,
    stickers0: lock ? lock.stickers : S.customize.placed};
  myBuild.beamCells = beamCellsOf(myBuild, lock ? lock.layout : getLayout());  // S16-WHEELS
  $("playerClass").textContent = t(weightClass(myBuild)) + " · " + ENGINE.physStats(myBuild).massKg.toFixed(2) + " kg";
  renderNums($("playerNums"), myBuild);
  $("playerCv")._build = myBuild;
  { const pp = $("playerCv").parentElement;                                    // E4 : tapis classe S
    if (pp) pp.classList.toggle("rc-portrait--cls-s", chassisClassOf(myBuild.chassis)==="S"); }
  drawEditor($("playerCv"), myBuild, lock ? lock.layout : getLayout(), editSpin, -1);
  // l'adversaire de CETTE manche
  const o = vsOpp;
  $("oppName").textContent = o.name;
  { const pw = $("scoutCv") && $("scoutCv").parentElement;                        // S11a
    if (pw && pw.classList.contains("rc-portrait")){
      pw.classList.toggle("rc-portrait--cls-s", !!(o.build&&chassisClassOf(o.build.chassis)==="S"));   // E4
      let h=0; const nm=($("oppName").textContent||""); for(const ch of nm) h=(h*31+ch.charCodeAt(0))>>>0;
      pw.classList.remove("rc-portrait--foe1","rc-portrait--foe2");
      pw.classList.add(h%2 ? "rc-portrait--foe2" : "rc-portrait--foe1"); } }
  $("oppClass").textContent = t(weightClass(o.build)) + " · " + ENGINE.physStats(o.build).massKg.toFixed(2) + " kg";
  $("oppWeight").textContent = t("level")+" "+o.level;
  $("oppTend").textContent = t(ENGINE.tendencyKey(o.build));
  renderNums($("oppNums"), {...o.build, power:"mixed"});
  ensureOppColor(o);
  $("scoutCv")._oppBuild = o.build;
  drawEditor($("scoutCv"), o.build, autoArrange(o.build), editSpin, -1);
  // comportement, ici et seulement ici (une source : le pilote DU BOT)
  const rows = $("paramRows"); rows.innerHTML = "";
  let hidden = 0;
  for (const key of ["strategy","aggression","edgeGuard","approach","chargeDist","handling"]){
    const f = makeSeg(key); if (f) rows.appendChild(f); else hidden++;
  }
  if (hidden > 0){                                           // S15 : mention UNIQUE
    const hint = document.createElement("div"); hint.className = "rc-label";
    hint.style.cssText = "margin-top:4px;color:var(--rc-muted)";
    hint.textContent = t("moreCtrlHint");
    rows.appendChild(hint);
  }
  $("styleLine").textContent = t("styleLabel")+" "+t(ENGINE.tendencyKey(PILOT()));
  const pr = $("powerRow"); pr.innerHTML = ""; const pf = makeSeg("power"); if (pf) pr.appendChild(pf);
  anchorVs();
}
/* S16-UI — le « VS » se cale sur le CENTRE DES PORTRAITS. Il etait centre sur
   toute la carte versus : des lors qu'un camp gagnait une ligne (poids,
   tendance, libelle long), ce centre descendait et le VS retombait sur les
   noms. Mesure au rendu, repli CSS si la mise en page n'est pas encore faite. */
function anchorVs(){
  try{
    const vs = document.querySelector(".rc-vs");
    const port = $("playerCv") && $("playerCv").parentElement;
    if (!vs || !port) return;
    const y = port.offsetTop + port.offsetHeight/2;
    if (y > 8) vs.style.top = Math.round(y) + "px";
  }catch(_){}
}
function renderLigueScreen(){
  const lg = ligueById(curLigue); if(!lg) return;
  $("crumbRoot").textContent = t("tabFight");
  $("crumbRoot").className = "crumb-link";
  $("crumbRoot").onclick = ()=>NAV.uiBack();
  $("ligueName").textContent = da(dataName(lg.name));
  const el = $("concoursList");
  // re-parquer les vues de detail AVANT de vider la liste (sinon innerHTML les detruit)
  for (const did of ["tourneyBanner"]){   // S38-HUB : le classement/tableau a migré sur l'écran VS ; seul le bandeau échelle reste ici
    const n = $(did); if (n && n.parentElement !== $("ligueScreen")) $("ligueScreen").appendChild(n); }
  el.innerHTML = "";
  const myBuild = { chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts} };
  myBuild.beamCells = beamCellsOf(myBuild, getLayout());                       // S16-WHEELS : la pesee compte les longerons
  myBuild.eff = buildEff(AB());                                               // P0-1 : le CT refuse un organe vital HS
  for (const id of lg.concours){
    const tr = tournamentById(id); if(!tr) continue;
    const st = CN(id), open = concoursUnlocked(id), chk = checkEntry(myBuild, tr.rules);   // S25 : dérivé
    const card = document.createElement("div");
    card.className = "rc-cup" + (open ? "" : " is-locked") + (st ? " rc-cup--violet" : "");
    if (tr.arena){                                                     // E5b : l'arène signe sa carte
      card.style.backgroundImage =
        "linear-gradient(90deg, rgba(16,8,13,.93) 30%, rgba(16,8,13,.72)), url('" + tr.arena + "')";
      card.style.backgroundSize = "cover";
      card.style.backgroundPosition = "center";
    }
    const prog = concoursProgress(tr);
    let inner = `<div class="rc-cup__head"><div>
        <div class="rc-cup__name">${da(dataName(tr.name))}</div>
        <div class="rc-cup__struct">${formatLabel(tr)}</div></div>
        <div class="rc-cup__progress"${prog?'':' style="color:var(--rc-muted)"'}>${prog||t("newTag")}</div></div>
      <div class="rc-cup__constraints"><span class="rc-chip">${rulesSummary(tr.rules)}</span>`;
    if (!chk.ok && open && !st)                       // éligibilité DÉTAILLÉE si refus
      inner += chk.fails.map(f=>`<span class="rc-chip rc-chip--red">✗ ${f}</span>`).join("");
    else if (open && !st && !tr.noEngage)
      inner += `<span class="rc-chip rc-chip--violet">✓ ${t("scrPass")}</span>`;
    /* S25 — les étoiles obtenues, et QUAND c'est verrouillé, le seuil qui
       manque, nommé. Un verrou qu'on ne sait pas ouvrir n'est pas un verrou,
       c'est un mur. */
    if (!tr.noStars){
      const n = starsOf(id);
      inner += `<div class="rc-cup__stars" style="letter-spacing:2px;color:${n?"var(--rc-amber,#ffd166)":"var(--rc-muted)"}">`
             + "\u2605".repeat(n) + "\u2606".repeat(3-n) + `</div>`;
    }
    if (!open){
      const miss = missingStarFor(id);
      if (miss) inner += `<div class="rc-cup__hint rc-label" style="color:var(--rc-muted);margin-top:4px">`
        + t("needStar", { c: miss.concours.map(x=>da(dataName(tournamentById(x).name))).join(", ") }) + `</div>`;
    }
    inner += `</div><div class="rc-cup__foot"></div>`;
    card.innerHTML = inner;
    const foot = card.querySelector(".rc-cup__foot");
    const btn = (label, cls, fn) => { const b=document.createElement("button");
      b.className="rc-btn "+(cls||""); b.textContent=label; b.onclick=(e)=>{ e.stopPropagation(); fn(); }; foot.appendChild(b); return b; };
    /* S38-HUB — HIÉRARCHIE : poursuivre un concours ENGAGÉ (« Disputer ») est
       l'action forte (rouge, pleine largeur) ; s'ENGAGER dans un nouveau concours
       est secondaire (fantôme). Plus de mur de boutons rouges identiques. */
    if (!open){ /* verrouillé : rien à faire */ }
    else if (tr.noEngage){                            // échelle, combat libre : action directe, forte
      btn(tr.format==="ladder" ? t("dispute") : t("freeFight"), "rc-btn--primary rc-btn--block", ()=>disputeConcours(id));
    } else if (!st){
      btn(t("engage"), "rc-btn--ghost", ()=>{         // s'engager : secondaire
        const r = engageConcours(id);
        if (!r.ok){ showToast((r.fails&&r.fails[0]) || t("soon")); return; }
        renderLigueScreen(); saveState();
      });
    } else {
      btn(t("dispute"), "rc-btn--primary rc-btn--block", ()=>disputeConcours(id));   // poursuivre : action forte
      const ab = btn(t("abandon"), "rc-btn--ghost", ()=>{
        if (!ab._arm){ ab._arm = true; ab.textContent = t("confirmAbandon"); return; }   // deux taps
        abandonConcours(id); renderLigueScreen(); renderLigues();
      });
    }
    el.appendChild(card);
    // la progression du concours vit DANS sa vignette (échelle) ; championnat/coupe → écran VS (hub)
    if (tr.id === "sumoM" && $("tourneyBanner")) card.appendChild($("tourneyBanner"));
  }
}
/* B3 — occasions. Stock DÉTERMINISTE par jour (graine = jour civil) : même
   étal toute la journée, renouvelé le lendemain — la boutique vit sans serveur.
   L'usure décote le prix. PROVISION chantier C : quand la condition par
   instance existera, l'usure achetée suivra la pièce (offer.wear est déjà là). */
function refreshUsedStock(){
  const day = Math.floor(Date.now()/86400e3);
  if (S.usedDay === day && Array.isArray(S.usedStock)) return;
  let seed = (day*2654435761)>>>0 || 1;
  const rnd = ()=>{ seed=(Math.imul(seed,48271)>>>0)%2147483647; return seed/2147483647; };
  const pool = [];
  for (const sl of Object.keys(ENGINE.PARTS))
    for (const pt of ENGINE.PARTS[sl]) if (pt.cost > 0) pool.push([sl, pt]);
  const offers = [];
  const n = 3 + Math.floor(rnd()*3);                     // 3 à 5 offres
  for (let i=0; i<n && pool.length; i++){
    const [sl, pt] = pool.splice(Math.floor(rnd()*pool.length), 1)[0];
    const wear = Math.round(15 + rnd()*30);              // 15–45 %
    offers.push({ slot:sl, id:pt.id, wear,
      price: Math.max(1, Math.round(pt.cost*(1 - wear*0.009))), qty:1 });
  }
  S.usedDay = day; S.usedStock = offers; saveState();
}
/* E2 — BOT D'OCCASION ASSEMBLÉ (le « pont » validé au simulateur).
   Une offre par jour, déterministe (graine du jour, pas de reroll) :
   châssis achetable + un composant par slot de base, chacun en tier
   intermédiaire (JAMAIS le top du catalogue), usure 20-50 %.
   Prix = (châssis + Σ pièces×(1-usure×0.9)) × 0.88 (prime d'assemblage
   inversée) — avantageux, pas dominant : c'est testé. */
function refreshUsedBot(){
  const day = Math.floor(Date.now()/86400e3);
  if (S.usedBotDay === day && S.usedBotOffer !== undefined) return;
  let seed = ((day*1103515245+12345)>>>0) || 1;
  const rnd = ()=>{ seed=(Math.imul(seed,48271)>>>0)%2147483647; return seed/2147483647; };
  const ch = BUYABLE_CHASSIS[Math.floor(rnd()*BUYABLE_CHASSIS.length)];
  const parts = [];
  for (const sl of Object.keys(BASE_KIT)){
    const xs = ENGINE.PARTS[sl].filter(p=>p.cost>0);
    if (!xs.length){ parts.push({ slot:sl, id:BASE_KIT[sl], wear:0, cost:0 }); continue; }
    // garde-fou : jamais la GAMME sommet (par gamme, pas par position — la gamme
    // micro est ajoutée en fin de catalogue et n'est PAS le haut de gamme).
    const maxG = Math.max(...xs.map(p=>gammeDe(sl, p.id)));
    const pool = xs.filter(p=>gammeDe(sl, p.id) < maxG);
    const cands = pool.length ? pool : xs;
    const pt = cands[Math.floor(rnd()*cands.length)];
    parts.push({ slot:sl, id:pt.id, wear:Math.round(20+rnd()*30), cost:pt.cost });
  }
  /* E2-FIT — l'offre doit RENTRER sur sa coque : une S ne loge pas des pièces M.
     On répare comme un adversaire (substitution micro puis dégradation), DÉTERMINISTE,
     puis on réaligne ids ET coûts. Sans ça la vignette ne dessine rien ET le bot
     ACHETÉ serait __nofit (coque seule, CT en échec, invendable en piste). */
  { const rp = { chassis:ch, parts:{}, counts:{} };
    for (const p of parts) rp.parts[p.slot] = p.id;
    repairFit(rp);                                       // substitution micro + dégradation (best-effort)
    const pm = { ...rp.parts };
    /* GARANTIE de fit : repairFit ne garantit rien (il rend le build même non logé,
       la garde S21 couvrant le runtime, et son verdict lit un build qu'il mute).
       On revérifie donc sur un build NEUF à chaque test, et on ramène tout slot
       encore bloquant au kit de base (stock, toujours logeable). Déterministe. */
    const fits = () => fitsOnHull({ chassis:ch, parts:{ ...pm }, counts:{} });
    for (const sl of ["propulsion","battery","motor","cpu","sensors"]){
      if (fits()) break;
      pm[sl] = BASE_KIT[sl];
    }
    for (const p of parts){                              // réaligne ids + coûts sur le build logé
      if (pm[p.slot] && pm[p.slot] !== p.id){
        p.id = pm[p.slot];
        const np = ENGINE.PARTS[p.slot].find(x => x.id === p.id);
        p.cost = np ? np.cost : 0;
      }
    }
  }
  const raw = CHASSIS_INFO[ch].cost + parts.reduce((a,p)=>a+p.cost*(1-p.wear*0.009),0);
  S.usedBotDay = day;
  S.usedBotOffer = { chassis:ch, parts, price:Math.round(raw*0.88), newPrice:Math.round(CHASSIS_INFO[ch].cost+parts.reduce((a,p)=>a+p.cost,0)) };
  saveState();
}
function buyUsedBot(){
  refreshUsedBot();
  const o = S.usedBotOffer; if (!o) return false;
  if (S.bolts < o.price){ showToast(t("noBolts")); return false; }
  S.bolts -= o.price;
  const bot = bareBot(o.chassis);                          // constructeur canonique
  bot.customize.color = CHASSIS_COLORS[1+Math.floor(Math.random()*(CHASSIS_COLORS.length-1))];
  for (const p of o.parts) bot.fit[p.slot] = [ mintInto(S.inv, p.id, { wear:p.wear }) ];
  refit(bot);
  assignBotId(bot); S.garage.push(bot); S.activeBot = S.garage.length-1;
  S.usedBotOffer = null;                                   // vendu — retour demain
  syncActive(); recomputeOwned(); saveState();
  showBotReceived(bot.chassis, chassisName(bot.chassis), t("usedRecvSub"), null, bot); // E9 + S36 : bot COMPLET
  showTab("workshop"); renderHome();
  return true;
}
function renderUsedBotSection(g){
  refreshUsedBot();
  const o = S.usedBotOffer;
  const plate = document.createElement("div"); plate.id = "usedBotPlate";
  g.appendChild(plate);
  const h = document.createElement("div"); h.className = "rc-section used";
  h.textContent = t("shopUsedBot"); plate.appendChild(h);
  if (!o){ const e=document.createElement("div"); e.className="rc-label";
    e.textContent=t("usedBotSold"); plate.appendChild(e); return; }
  const card = document.createElement("div"); card.className = "rc-usedbot";
  const th = document.createElement("div"); th.className = "rc-botcell__thumb rc-botcell__thumb--big";
  { const parts = {};                                                    // E5 : le bot ASSEMBLÉ
    for (const p of o.parts){ const sl = DEF_SLOT[p.id]; if (sl) parts[sl] = p.id; }
    // S17-VIEW + fix vignette : la coque ne se dessine (sprite) qu'avec une couleur.
    // On prévisualise avec la couleur d'usine que le bot AURA à l'achat (bareBot),
    // sinon la vignette montrait les pièces mais PAS le châssis.
    const b = buildOfBot({ chassis:o.chassis, parts, counts:{}, color:o.color||DEFAULT_CHASSIS_COLOR });
    const cv = document.createElement("canvas"); cv.width = cv.height = 176;
    cv.style.width = "100%"; cv.style.height = "100%"; cv.style.display = "block";
    /* S16-GARAGE — le canvas d'occasion etait dessine UNE fois, hors du
       registre : si le sprite de coque n'etait pas encore decode, le chassis
       manquait DEFINITIVEMENT (les pieces, elles, ont un repli vectoriel).
       Enregistre, il se redessine des que l'image arrive. */
    /* S33-VIGNETTE — le catch etait MUET : si drawEditor jetait, le fond
       d'atelier restait et la coque manquait DEFINITIVEMENT, sans une ligne au
       journal. On a cherche un probleme de chargement d'image la ou il y avait
       peut-etre une exception avalee. Le rendu reste protege (une vignette ne
       doit jamais casser la boutique) mais il PARLE desormais. */
    regTile(cv, ()=>{ try { drawEditor(cv, b, autoArrange(b), 0, -1); }
                      catch(e){ logError("vignette", "occasion "+o.chassis+" : "+(e&&e.message), "app.js", 0); } });
    th.appendChild(cv); }
  card.appendChild(th);
  const info = document.createElement("div"); info.className = "rc-usedbot__info";
  const ws = o.parts.filter(p=>p.cost>0).map(p=>p.wear);
  info.innerHTML = `<div class="rc-name">${chassisName(o.chassis)}</div>
    <div class="rc-label">${o.parts.filter(p=>p.cost>0).map(p=>da(t("pn_"+p.id))).join(" · ")}</div>
    <div class="rc-gcard__fx">${t("usedWear",{w:Math.min(...ws)+"\u2013"+Math.max(...ws)})}</div>`;
  card.appendChild(info);
  const btn = document.createElement("button"); btn.className = "rc-buy";
  btn.innerHTML = `<s>${o.newPrice}</s> ${BOLT_SVG} ${o.price}`;
  btn.disabled = S.bolts < o.price;
  btn.onclick = buyUsedBot;
  card.appendChild(btn);
  plate.appendChild(card);
}
function renderUsedSection(g){
  refreshUsedStock();
  if (!S.usedStock.length) return;
  const plate = document.createElement("div"); plate.id = "usedPlate";         // P1 : plaque de tête distincte
  g.appendChild(plate);
  const h = document.createElement("div"); h.className = "rc-section used";
  h.textContent = t("shopUsed"); plate.appendChild(h);
  const strip = document.createElement("div"); strip.className = "rc-carousel";
  plate.appendChild(strip);
  for (const of_ of S.usedStock){
    const part = ENGINE.PARTS[of_.slot].find(p=>p.id===of_.id); if (!part) continue;
    const card = document.createElement("div"); card.className = "rc-gcard usedcard";
    const art = document.createElement("div"); art.className = "rc-gcard__art";
    const cv = tileCanvas(54, (c)=>drawPartTile(c, of_.slot, part.id, 27, 27, 50, 44, 0, 1));
    art.appendChild(cv); card.appendChild(art);
    const nm = document.createElement("div"); nm.className = "rc-gcard__name"; nm.textContent = t("pn_"+part.id);
    card.appendChild(nm);
    const wr = document.createElement("div"); wr.className = "rc-gcard__fx usedwear";
    wr.textContent = t("usedWear", {w:of_.wear});
    card.appendChild(wr);
    if (of_.qty <= 0){
      const so = document.createElement("div"); so.className = "sprice"; so.textContent = t("usedSold");
      card.appendChild(so);
    } else {
      const btn = document.createElement("button"); btn.className = "rc-buy used";
      btn.innerHTML = "<s>"+part.cost+"</s> "+of_.price+" "+BOLT_SVG;
      btn.disabled = S.bolts < of_.price;
      btn.onclick = ()=>{ if (S.bolts < of_.price || of_.qty<=0) return;
        S.bolts -= of_.price; of_.qty = 0;
        mintInstance(of_.id, { wear: of_.wear });        // l'usure achetée suit l'instance
        recomputeOwned(); saveState(); showToast(t("bought", {name:t("pn_"+of_.id)})); renderHome(); };
      card.appendChild(btn);
    }
    strip.appendChild(card);
  }
}
function renderGarage(){
  const g = $("garageRows"); g.innerHTML = "";
  const ut = $("usedTop"); if (ut){ ut.innerHTML = ""; renderUsedSection(ut); renderUsedBotSection(ut); }   // P1+E2
  const TYPES = SLOT_ORDER.filter(x=>x!=="chassis" && !RETIRED_SLOTS[x] && !SHOP_HIDE_SLOTS[x]).map(x=>[x,"slot_"+x]);
  for (const [type, header] of TYPES){
    // vitrine : retire les pièces masquées + les options « aucun », puis TRIE S d'abord
    let parts = ENGINE.PARTS[type].filter(p => !SHOP_HIDE_PARTS[p.id] && !(SHOP_HIDE_NONE[type] && (p.cost|0)===0));
    if (!parts.length) continue;
    parts = parts.slice().sort((a,b)=> ((b.intendedClass==="S")?1:0) - ((a.intendedClass==="S")?1:0));
    const h = document.createElement("div"); h.className = "rc-section";
    h.textContent = t(header);
    g.appendChild(h);
    const strip = document.createElement("div"); strip.className = "rc-carousel";
    g.appendChild(strip);
    if (ENGINE.PARTS[type].length === 1){
      strip.appendChild(mkPartCard(type, parts[0], true));
      continue;
    }
    for (const part of parts) strip.appendChild(mkPartCard(type, part, false));
  }
  // stickers: cheap cosmetics, bought here, placed in the workshop
  const h = document.createElement("div"); h.className = "rc-section"; h.textContent = t("persoSticker");
  g.appendChild(h);
  const strip = document.createElement("div"); strip.className = "rc-carousel";
  g.appendChild(strip);
  for (const st of STICKERS){
    const owned = S.customize.stickers.includes(st.id);
    const card = document.createElement("div"); card.className = "rc-gcard stickercard"+(owned?" owned":"");
    card.innerHTML = `<div class="rc-gcard__art"><img src="${st.src}" alt="${st.id}" style="max-width:92%;max-height:92%;object-fit:contain"></div>`+
      (owned ? `<div class="rc-gcard__fx">${t("stickerOwned")}</div>` : "");
    if (!owned){
      const btn = document.createElement("button"); btn.className="rc-buy";
      btn.innerHTML = `${BOLT_SVG} ${st.cost}`;                     // same style as part cards
      btn.disabled = S.bolts < st.cost;
      btn.onclick = ()=>{ if (S.bolts < st.cost) return; S.bolts -= st.cost;
        S.customize.stickers.push(st.id); saveState();
        showToast(t("bought", {name:st.id})); renderHome(); };
      card.appendChild(btn);
    }
    strip.appendChild(card);
  }
  /* Plaques de version : jamais achetées — offertes avec le logiciel (v0 d'office).
     Seules les plaques dont le logiciel existe au catalogue sont exposées ;
     le reste de la banque attend les futurs niveaux. */
  const vh = document.createElement("div"); vh.className = "rc-section"; vh.textContent = t("stickVersions"); g.appendChild(vh);
  const vstrip = document.createElement("div"); vstrip.className = "rc-carousel"; g.appendChild(vstrip);
  const swIds = new Set((ENGINE.PARTS.software||[]).map(p=>p.id));
  for (const v of VSTICKERS){
    if (v.sw !== null && !swIds.has(v.sw)) continue;         // en banque
    const got = v.sw === null || softwareOwned(v.sw);
    const card = document.createElement("div"); card.className = "rc-gcard stickercard"+(got?" owned":"");
    card.innerHTML = `<div class="rc-gcard__art"><img src="${v.src}" alt="${v.id}" style="max-width:92%;max-height:92%;object-fit:contain"></div>
      <div class="rc-gcard__fx">${got ? t("stickerAuto") : t("stickerWithSw", {v:v.id})}</div>`;
    vstrip.appendChild(card);
  }
}
// static assembled preview of a build (player card + scouting)
function drawBotPreview(canvas, build, color, isPlayer){
  const c = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  c.clearRect(0,0,w,h);
  const ch = ENGINE.CHASSIS[build.chassis];
  const fake = { radius:ch.radius, build, flippedT:0, dominatedT:0 };
  c.save();
  c.translate(w/2, h/2); c.rotate(-Math.PI/2);
  const sc = Math.min(w,h) / (ch.radius*3.3);
  c.scale(sc, sc);
  drawBot(c, fake, color, isPlayer, {t:0, odo:0, vib:0});
  c.restore();
}

function showToast(msg, ms=1600){
  $("toastText").textContent = msg;
  $("toast").style.display = "flex";
  setTimeout(()=>{ $("toast").style.display="none"; }, ms);
}

/* ══ S16-CRASH — boîte noire (25/07). Le « full freeze » du playtest est une
   exception synchrone qui tue la boucle raf : l'écran combat reste affiché,
   plus rien ne répond. On ne peut pas la reproduire en jsdom (les erreurs
   canvas n'existent que dans le vrai navigateur), donc on la rend OBSERVABLE
   et NON BLOQUANTE :
   1. window.onerror + unhandledrejection → journal persistant (5 dernières,
      localStorage roboclash_errlog), consultable dans Réglages ;
   2. toute erreur pendant un combat → toast + retour propre à l'accueil au
      lieu d'un écran mort ;
   3. les entrées critiques (revanche, lancement) sont ceinturées.
   Au prochain gel : Réglages → la ligne ERREUR donne message + ligne. ══ */
const ERRLOG_KEY = "roboclash_errlog";
function errlog(){ try{ return JSON.parse(localStorage.getItem(ERRLOG_KEY)||"[]"); }catch(_){ return []; } }
function logError(kind, msg, src, line){
  try{
    const log = errlog();
    log.unshift({ t:new Date().toISOString().slice(0,19), kind,
                  msg:String(msg).slice(0,180), at:(src?String(src).split("/").pop():"")+":"+(line||"?") });
    localStorage.setItem(ERRLOG_KEY, JSON.stringify(log.slice(0,5)));
  }catch(_){}
}
function crashRecover(where, e){
  logError(where, e && e.message || e, e && e.fileName, e && e.lineNumber);
  try{ cancelAnimationFrame(raf); }catch(_){}
  try{ $("overlay").style.display="none"; }catch(_){}
  try{ showToast("ERREUR: " + String(e && e.message || e).slice(0,60), 3000); }catch(_){}
  try{ if (NAV.stack.length > 1) NAV.uiBack(); }catch(_){}
}
window.addEventListener("error", (ev)=>{
  logError("onerror", ev.message, ev.filename, ev.lineno);
  // un combat mort à l'écran = gel perçu : on récupère
  const ms = $("matchScreen");
  if (match && !match.over && ms && ms.style.display !== "none") crashRecover("raf", ev);
});
window.addEventListener("unhandledrejection", (ev)=>{
  logError("promise", ev.reason && ev.reason.message || ev.reason);
});

/* ============================================================
   MATCH (rendering + loop)
   ============================================================ */
let match=null, raf=null, slowmoT=0, shake=0, lastTs=0, acc=0, flipAnim=[0,0], domShown=[false,false];
let particles=[], trails=[[],[]], flashes=[0,0], wasForfeit=false, odom=[0,0], floaties=[]; let wheelPhase=[0,0], slipR=[0,0];
const cv = $("cv"), ctx = cv.getContext("2d");

function setupCanvas(){
  /* FID-1 — le bug de cadrage venait d'ici : style.width jamais posé, le CSS
     width:100% prenait le dessus et étirait le cercle dès que le conteneur
     dépassait 520 px. Désormais : carré verrouillé sur la plaque .rc-arena. */
  const dpr = window.devicePixelRatio || 1;
  const box = $("arenaBox") || cv.parentElement;
  const w = Math.round(box.clientWidth || 420);
  cv.width = w*dpr; cv.height = w*dpr;
  cv.style.width = w+"px"; cv.style.height = w+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

let curMode = "qual"; // "qual" | "tour" | "exhib" | "championnat"
let exhibOpp = null, champOpp = null, bracketOpp = null;

/* S6 — l'adversaire d'une manche est fabriqué UNE fois (à l'entrée de l'écran
   VS quand on y passe, sinon au lancement) et le combat affronte exactement
   celui qui a été montré. */
let vsOpp = null, vsMode = null, curVsConcours = null;
function makeOpponent(mode){
  if (mode === "tour"){ ensureTourney(); return S.tourney.opponents[S.tourney.idx]; }
  if (mode === "exhib"){
    /* CALIBRAGE — un concours qui déclare `benchmark` ne TIRE pas son
       adversaire : il le lit dans ENGINE.BENCHMARKS, figé, châssis, pièces et
       pilote compris. C'est ce qui rend deux mesures comparables dans le temps. */
    const bm = benchmarkOf(curVsConcours);
    if (bm){ exhibOpp = { name:bm.name, archetype:"etalon", build:{...bm.build}, level:0, benchmark:true };
             return exhibOpp; }
    const g = genOpponentFit(Math.floor(Math.random()*1e9), S.level, opponentOpts(curVsConcours));
    exhibOpp = { name:pickName(), archetype:g.archetype, build:g.build, level:S.level };
    return exhibOpp;
  }
  if (mode === "championnat"){
    const g = genOpponentFit(Math.floor(Math.random()*1e9), S.level, opponentOpts(curVsConcours));
    champOpp = { name: FORMATS.championnat.faced(S.concours[curVsConcours]).name, archetype:g.archetype, build:g.build, level:S.level };
    return champOpp;
  }
  if (mode === "bracket"){
    const bst = S.concours[curVsConcours];
    const opp = FORMATS.bracket.myOpponent(bst);
    const g = genOpponentFit((bst.seed ^ (bst.round*7))>>>0, S.level, opponentOpts(curVsConcours));
    bracketOpp = { name: opp.name, archetype:g.archetype, build:g.build, level:S.level };
    return bracketOpp;
  }
  ensureOpponent(); return S.opponent;
}
/* S20-SCRUTIN — UNE seule source pour « quel concours se dispute ». MODE_CONCOURS
   ne mappe que le format vers un id HISTORIQUE (bracket→cupM, championnat→lightM) :
   s'en servir pour retrouver l'état d'un concours faisait chercher l'engagement
   de la Coupe M quand on disputait la Coupe des Puces. curVsConcours porte l'id
   réel, posé par disputeConcours / enterBracket / enterChampionnat. */
function curConcoursId(){ return curVsConcours || MODE_CONCOURS[curMode] || null; }
function startMatch(mode){
  curMode = mode || (tournamentOpen() ? "tour" : "qual");
  /* S16-CRASH — gardes de mode. Un vsMode/curMode périmé peut demander une
     compétition consommée (échelle gagnée, saison finie, coupe terminée) :
     on rétrograde ou on refuse PROPREMENT au lieu de déréférencer null. */
  if (curMode === "tour"){
    if (!tournamentOpen()) curMode = "qual";                   // échelle fermée : combat de qualification
    else { ensureTourney(); if (!S.tourney) curMode = "qual"; } // ouverte : recréer si consommée
  }
  if (curMode === "championnat" || curMode === "bracket"){
    const cid = curVsConcours || MODE_CONCOURS[curMode];
    if (!CN(cid)){ showToast(t("concoursOver")); return; }
  }
  const enemy = (vsMode === curMode && vsOpp) ? vsOpp : makeOpponent(curMode);

  const seed = Math.floor(Math.random()*1e9);
  // bracket: the build is LOCKED at entry — only pilot params (AB().pilot) change between bouts.
  /* S20-SCRUTIN — le gel se lisait sur MODE_CONCOURS[curMode], donc sur cupM /
     lightM UNIQUEMENT : pour toute autre épreuve (sumoS, sparS, cupS…) le lock
     valait null et le combat repartait du build VIVANT du garage. lockBuild
     était inerte hors des deux concours M, et une pièce ajoutée après
     l'engagement entrait en piste. */
  const lock = healBrokenLock(curConcoursId());   // build gelé si le concours le déclare ; verrou cassé → resync sur l'actif
  /* Phase 2 — le combat se résout contre le bot ENGAGÉ (par botId), jamais l'actif :
     changer S.activeBot après l'engagement ne détourne plus ni usure ni dégâts. */
  const combatBot = (lock && botById(lock.botId)) || AB();
  const pLayout = lock ? lock.layout : getLayout();
  /* E7/P0-1 — CT à la DISPUTE. L'homologation d'engagement ne voit l'usure
     QU'UNE FOIS ; elle grimpe manche après manche et un organe vital (moteur /
     propulsion / batterie) peut passer HS EN COURS de concours. Un bot HS ne
     translate plus — grip/force motrice à 0 — mais tourne encore sur place
     (angVel indépendante) : roues qui patinent, robot immobile. On refuse le
     combat et on renvoie réparer, au lieu de lancer une manche injouable. */
  { const ctBuild = { chassis: lock ? lock.chassis : AB().chassis,
                      parts: {...(lock ? lock.parts : S.parts.equipped)},
                      counts: {...(lock ? (lock.counts||{}) : AB().counts)},
                      eff: buildEff(combatBot) };
    const fc = functionalCheck(ctBuild);
    if (!fc.ok){ showToast(fc.fails[0]); return; } }
  const playerBuild = {...ENGINE.SLICE1.playerBuild, ...effectivePilot(combatBot),
    chassis: lock ? lock.chassis : AB().chassis,
    parts: {...(lock ? lock.parts : S.parts.equipped)},
    counts: {...(lock ? (lock.counts||{}) : AB().counts)},
    color: lock ? lock.color : S.customize.color,
    stickers0: lock ? lock.stickers : S.customize.placed};
  ensureOppColor(enemy);
  // Pass 3: CG stability from the actual placement feeds the flip model.
  playerBuild.stability = computeCG(playerBuild, pLayout).stability;
  playerBuild.beamCells = beamCellsOf(playerBuild, pLayout);                  // S16-WHEELS : masse réelle en combat
  enemy.build.stability = computeCG(enemy.build, autoArrange(enemy.build)).stability;
  enemy.build.beamCells = beamCellsOf(enemy.build, autoArrange(enemy.build));
  // WYSIWYG per-component hitbox from the same placement.
  playerBuild.colliders = buildColliders(playerBuild, pLayout);
  playerBuild.eff = buildEff(combatBot);                     // E3b/Phase 2 : l'usure du bot ENGAGÉ mord en combat
  enemy.build.colliders = buildColliders(enemy.build, autoArrange(enemy.build));
  /* S16-SCALE — ring RÉEL par classe (données CLASS_RING), en unités monde.
     La classe vient du concours (ses règles priment) sinon du bot joueur.
     Défaut d'arène hors concours : desk nerd en S, dohyo classique en M. */
  { const trId = curConcoursId() || (curMode==="qual"||curMode==="tour" ? "sumoM" : null);
    const tr = trId ? tournamentById(trId) : null;                               // S11b
    const cls = (tr && tr.rules && tr.rules.chassisClass) || chassisClassOf(playerBuild.chassis);
    const ringCm = CLASS_RING[cls] || CLASS_RING.M;
    match = ENGINE.makeMatch(seed, playerBuild, enemy.build,
                             { arenaR: (ringCm/CM_PER_UNIT)/2 });
    const src = (tr && tr.arena) || (cls === "S" ? "assets/arena_s_nerd.webp" : null);
    match.arenaSprite = arenaFor(src);
    match.arenaGeom = ARENA_GEOM[src || ARENA_SRC] || { playEdge:0.95 }; }
  /* Phase 2 — ENVELOPPE DE MATCH : une seule source pour le rendu ET les dégâts.
     Rien dans la boucle de match ne relit S.activeBot, getLayout() ou S.customize. */
  match.player = { botId: combatBot.botId, layout: pLayout, color: playerBuild.color, placed: playerBuild.stickers0 };
  match.enemyLayout = autoArrange(enemy.build);              // gelé une fois (plus d'autoArrange par frame)
  particles=[]; trails=[[],[]]; flashes=[0,0]; slowmoT=0; shake=0; acc=0; lastTs=0; wasForfeit=false; odom=[0,0]; floaties=[]; wheelPhase=[0,0]; slipR=[0,0]; flipAnim=[0,0]; domShown=[false,false];
  $("hudNameA").textContent = t("you");
  $("hudNameB").textContent = enemy.name || "";
  $("hudRound").textContent = vsMode===curMode && curVsConcours ? vsMancheLabel(tournamentById(curVsConcours)) : "";
  if (NAV.stack[NAV.stack.length-1] === "vsScreen") NAV.swap("matchScreen");
  else NAV.push("matchScreen");
  $("overlay").style.display="none";
  $("speedBtn").textContent = "×"+S.speed;
  setupCanvas();
  raf = requestAnimationFrame(frame);
}

function frame(ts){
  if (!lastTs) lastTs = ts;
  let dt = Math.min(0.05, (ts-lastTs)/1000); lastTs = ts;
  let scale = S.speed;
  if (slowmoT > 0){ scale = 0.18; slowmoT -= dt; }
  acc += dt*scale;
  const T = ENGINE.TICK;
  while (acc >= T && !match.over){
    const evBefore = match.events.length;
    ENGINE.tick(match);
    for (let i=evBefore;i<match.events.length;i++){
      const ev = match.events[i];
      if (ev.type==="impact"){
        spawnSparks(ev.x, ev.y, Math.min(18, 4+ev.impulse*0.15));
        shake = Math.min(8, ev.impulse*0.06);
      }
      if (ev.type==="end") slowmoT = 0.8;
      if (ev.type==="flip"){ shake = 8; slowmoT = Math.max(slowmoT, 0.7); flipAnim[ev.bot] = 1;
        const b = match.bots[ev.bot];
        for(let k=0;k<14;k++) particles.push({x:b.pos.x,y:b.pos.y,vx:(Math.random()-0.5)*120,vy:(Math.random()-0.5)*120,
          a:0.95, c:"#ffd166"}); }
      if (ev.type==="righted") flipAnim[ev.bot] = 1;
    }
    for (const bot of match.bots){
      odom[bot.id] += Math.hypot(bot.vel.x, bot.vel.y) * ENGINE.TICK;
      // wheels spin at the commanded speed; the SLIP tint now reads the engine's
      // real static→kinetic state (bot.slipAmt), not a display heuristic.
      {
        const drive = (bot.throttleL + bot.throttleR) * 0.5;
        wheelPhase[bot.id] += drive * bot.maxSpeed * ENGINE.TICK * 0.06;
        slipR[bot.id] = bot.slipAmt || 0;
      }
      if (bot.modeChanged){
        flashes[bot.id] = 0.25;
        // the ring now says WHAT the bot decided
        floaties.push({ x:bot.pos.x, y:bot.pos.y - bot.radius - 10,
          txt:t("mode_"+bot.mode), a:1, color:[PLAYER_COLOR,ENEMY_COLOR][bot.id] });
      }
      // the dashed ring = DOMINATED (losing the leverage duel): label it once per bout
      if (bot.dominatedT > 0 && !domShown[bot.id]){
        domShown[bot.id] = true;
        floaties.push({ x:bot.pos.x, y:bot.pos.y - bot.radius - 22,
          txt:t("domLabel"), a:1.2, color:"#ff5252" });
      } else if (bot.dominatedT <= 0){ domShown[bot.id] = false;
      }
      const facing = {x:Math.cos(bot.angle), y:Math.sin(bot.angle)};
      const fwd = bot.vel.x*facing.x + bot.vel.y*facing.y;
      const lat = Math.hypot(bot.vel.x - facing.x*fwd, bot.vel.y - facing.y*fwd);
      if (lat > 25 || bot.dominatedT > 0)
        trails[bot.id].push({x:bot.pos.x, y:bot.pos.y, a:0.5});
    }
    acc -= T;
  }
  for (const tr of trails){ for (const p of tr) p.a -= dt*0.6;
    while(tr.length && tr[0].a<=0) tr.shift(); if (tr.length>240) tr.splice(0,tr.length-240); }
  particles = particles.filter(p=>{ p.x+=p.vx*dt; p.y+=p.vy*dt; p.a-=dt*2.2; return p.a>0; });
  flashes = flashes.map(f=>Math.max(0,f-dt));
  for (const f of floaties){ f.y -= dt*14; f.a -= dt*0.8; }
  floaties = floaties.filter(f=>f.a>0);
  shake = Math.max(0, shake - dt*22);
  flipAnim[0]=Math.max(0,(flipAnim[0]||0)-dt*2.2); flipAnim[1]=Math.max(0,(flipAnim[1]||0)-dt*2.2);

  draw();
  $("clock").textContent = match.t.toFixed(1);
  $("gA").firstElementChild.style.width = (match.bots[0].battery/match.bots[0].batteryMax*100)+"%";
  $("gB").firstElementChild.style.width = (match.bots[1].battery/match.bots[1].batteryMax*100)+"%";
  // Santé — plomberie du chantier C : le moteur ne publie pas encore hp, la barre reste pleine.
  $("hA").firstElementChild.style.width = (((match.bots[0].hp ?? 1))*100)+"%";
  $("hB").firstElementChild.style.width = (((match.bots[1].hp ?? 1))*100)+"%";

  if (match.over && slowmoT<=0){ endToDebrief(); return; }
  raf = requestAnimationFrame(frame);
}

function spawnSparks(x,y,n){
  for (let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, s = 40+Math.random()*120;
    particles.push({x,y,vx:Math.cos(a)*s, vy:Math.sin(a)*s, a:0.9,
      c: Math.random()<0.5 ? "#ffd166" : "#ffffff"});
  }
}

function draw(){
  const w = cv.clientWidth || 420;
  /* S16-SCALE — l'échelle écran suit le ring du MATCH : un ring S de 60 cm
     (124 u) zoome naturellement ×2,4 vs le ring M — les bots gardent leur
     taille cellule, c'est la fenêtre qui change. */
  const AR = (match && match.arenaR0) || ENGINE.ARENA_R;
  const scale = w / (AR*2 + 6); // tight crop: max bot size on screen
  ctx.clearRect(0,0,w,w);
  ctx.save();
  const sx = (Math.random()-0.5)*shake, sy = (Math.random()-0.5)*shake;
  ctx.translate(w/2+sx, w/2+sy); ctx.scale(scale, scale);

  /* S16-SCALE — le bord du PLATEAU dessiné (playEdge du sprite, en données)
     coïncide avec le ring logique. Sprites opaques (square) : dessin carré
     plein cadre, aucun clip circulaire — le décor déborde du canvas, voulu. */
  const geom = (match && match.arenaGeom) || { playEdge:0.95 };
  /* S16 — arenes opaques : le repere playEdge du sprite (pour le desk, le
     bord EXTERNE de la bande blanche) tombe EXACTEMENT sur le ring logique.
     Purement graphique : ni le moteur ni les tailles ne bougent. Les arenes
     clippees gardent leur marge de +6 pour couvrir le disque de decoupe. */
  const side = geom.square ? (2*AR) / (geom.playEdge || 0.95)
                           : (2*AR + 12) / (geom.playEdge || 0.95);
  /* S16 — décentrage : quand le cercle du sprite n'est pas au centre du cadre,
     on décale le dessin pour que le CENTRE DU PLATEAU (pas de l'image) tombe sur
     l'origine logique. ox = -cx·side amène le point (0,5+cx) de l'image à 0. */
  const ox = -(geom.cx || 0) * side, oy = -(geom.cy || 0) * side;
  const aimg = (match && match.arenaSprite) || arenaImg;          // S11b
  if(aimg && aimg.complete && aimg.naturalWidth>0){               // arena sprite as the static floor
    if (geom.square){ ctx.drawImage(aimg, -side/2+ox, -side/2+oy, side, side); }
    else {
      ctx.save(); ctx.beginPath(); ctx.arc(0,0,AR+6,0,Math.PI*2); ctx.clip();
      ctx.drawImage(aimg, -side/2+ox, -side/2+oy, side, side); ctx.restore();
    }
  } else {
    ctx.beginPath(); ctx.arc(0,0,AR+8,0,Math.PI*2); ctx.fillStyle="#160c12"; ctx.fill();
    ctx.beginPath(); ctx.arc(0,0,AR,0,Math.PI*2); ctx.fillStyle="#1d1119"; ctx.fill();
  }
  // sudden-death: darken the shrinking-out zone + draw the live ring at match.arenaR
  if(match.arenaR < AR-1){
    /* P4 : angles EXACTS — 0..7 rad dépassait 2π et cousait un rayon clair à ~41°. */
    ctx.save(); ctx.beginPath();
    ctx.arc(0,0,AR+8,0,Math.PI*2); ctx.arc(0,0,match.arenaR,0,Math.PI*2,true);
    ctx.fillStyle="rgba(8,9,12,.62)"; ctx.fill("evenodd"); ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0,0,match.arenaR,0,Math.PI*2);
  ctx.lineWidth=3; ctx.strokeStyle = match.t>ENGINE.SUDDEN_DEATH_T ? "#ff2a4a" : "#ff9b3d"; ctx.stroke();

  const COLORS = [PLAYER_COLOR, ENEMY_COLOR];
  for (let bi=0;bi<2;bi++){
    ctx.fillStyle = COLORS[bi];
    for (const p of trails[bi]){ ctx.globalAlpha = p.a*0.35;
      ctx.beginPath(); ctx.arc(p.x,p.y,3,0,7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;

  // Phase 2 — WYSIWYG : le visuel du joueur est celui GELÉ à l'entrée en piste
  // (match.player), plus la lecture live du garage — cohérent avec la physique.
  match.bots[0].build.color = match.player.color;
  match.bots[0].build.stickers0 = match.player.placed;
  if (!match.bots[1].build.color) ensureOppColor({name:(S.opponent&&S.opponent.name)||"", build:match.bots[1].build});
  for (const bot of match.bots){
    // WYSIWYG: the live bot is the SAME editor visual — chassis + placed tiles.
    // editor "front" is up (−y); the bot faces +x, so add π/2 to align (cuit
    // dans renderBotComposite avec la culbute et le retournement).
    const fa = flipAnim[bot.id]||0;
    const flipped = bot.flippedT > 0;
    const layout = bot.id===0 ? match.player.layout : (match.enemyLayout || autoArrange(bot.build));
    const comp = renderBotComposite(bot, layout, flipped, fa);
    // S11c — ombre portée : silhouette exacte, lumière FIXE-MONDE (bas-droite),
    // décollée pendant la culbute, resserrée quand le bot gît sur le dos.
    /* S16-SCALE — décalage d'ombre ∝ rayon (l'absolu 4/8 faisait flotter les
       petits bots) : à r=22 (M) on retrouve ~3,5/6,6 ≈ l'ancien réglage. */
    const lift = 1 + fa*1.6;
    ctx.save();
    ctx.translate(bot.pos.x + bot.radius*0.16*lift, bot.pos.y + bot.radius*0.30*lift);
    ctx.rotate(bot.angle);
    ctx.globalAlpha = flipped ? 0.24 : 0.34;
    if ("filter" in ctx) ctx.filter = "blur(" + (bot.radius*0.11*lift).toFixed(1) + "px)";
    ctx.drawImage(comp.sil, -comp.S/2, -comp.S/2, comp.S, comp.S);
    ctx.restore();
    ctx.save();
    ctx.translate(bot.pos.x, bot.pos.y); ctx.rotate(bot.angle);
    const r = bot.radius;
    ctx.drawImage(comp.cv, -comp.S/2, -comp.S/2, comp.S, comp.S);
    // dominated: skid ring
    if (bot.dominatedT>0){ ctx.strokeStyle="rgba(255,255,255,.6)"; ctx.lineWidth=2;
      ctx.setLineDash([4,4]); ctx.beginPath(); ctx.arc(0,0,r+5,0,7); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
    if (flashes[bot.id]>0){
      ctx.strokeStyle = COLORS[bot.id]; ctx.globalAlpha = flashes[bot.id]*3;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bot.pos.x,bot.pos.y,bot.radius+9,0,7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  for (const p of particles){ ctx.globalAlpha=p.a; ctx.fillStyle=p.c;
    ctx.fillRect(p.x-1.5,p.y-1.5,3,3); }
  // mode labels: rise & fade above the bot
  ctx.font = "700 11px system-ui, sans-serif"; ctx.textAlign = "center";
  for (const f of floaties){
    ctx.globalAlpha = Math.min(1, f.a) * 0.95;
    ctx.fillStyle = f.color;
    ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.globalAlpha=1;
  ctx.restore();
}


/* ============================================================
   DEBRIEF
   ============================================================ */
function causeKey(m){
  const won = m.winner === 0;
  const player = m.bots[0];
  const duelDiff = m.duels[1] - m.duels[0];
  if (won){
    if (m.reason === "koFlip") return "win_flip";
    if (m.reason === "shrinkOut") return "win_shrink";
    if (m.duels[0] - m.duels[1] >= 2) return "win_duels";
    return "win_push";
  }
  if (m.reason === "koFlip") return "cause_flip";
  if (m.reason === "shrinkOut") return "cause_shrink";
  if (player.edgeTime > 0.35 * m.t) return "cause_edge";
  if (duelDiff >= 2) return "cause_dominated";
  return "cause_generic";
}

/* B2 — débriefing d'après-combat : tout vient de ce que le moteur enregistre déjà
   (battery, contactT, flippedT) + l'odomètre app. Régler au garage prend un sens
   quand on peut lire POURQUOI on a perdu. */
function renderDebrief(m){
  const el=$("ovStats"); if(!el) return; el.innerHTML="";
  if(!m || !m.bots) return;
  const od=(typeof odom!=="undefined"&&odom)||[0,0];
  const pc=(b)=>Math.round(100*b.battery/Math.max(1e-9,b.batteryMax))+"%";
  const endKey={shrinkOut:"endShrinkOut",ringOut:"endRingOut",koFlip:"endKoFlip"}[m.reason];
  const rows=[[t("dbBattery"),pc(m.bots[0]),pc(m.bots[1])],
              [t("dbDist"),od[0].toFixed(1)+" m",od[1].toFixed(1)+" m"],
              [t("dbContact"),m.bots[0].contactT.toFixed(1)+" s",m.bots[1].contactT.toFixed(1)+" s"],
              [t("dbFlipped"),(m.bots[0].flipAccT||0).toFixed(1)+" s",(m.bots[1].flipAccT||0).toFixed(1)+" s"]];
  const head=document.createElement("div"); head.className="rc-eyebrow";
  head.textContent=t("dbTitle")+" — "+m.t.toFixed(0)+" s · "+(endKey?t(endKey):(m.reason||""));
  el.appendChild(head);
  const tab=document.createElement("table"); tab.className="rc-debrief";
  const tr0=document.createElement("tr");
  [["" ,""],[t("you"),"color:var(--rc-violet-lt)"],[($("hudNameB")&&$("hudNameB").textContent)||"—","color:var(--rc-red-lt)"]]
    .forEach(([h,st])=>{ const th=document.createElement("th"); th.textContent=h; if(st) th.style.cssText=st; tr0.appendChild(th); });
  tab.appendChild(tr0);
  for(const [l,a,b] of rows){ const tr=document.createElement("tr");
    for(const v of [l,a,b]){ const td=document.createElement("td"); td.textContent=v; tr.appendChild(td); }
    tab.appendChild(tr); }
  el.appendChild(tab);
  /* E3b — rapport de dégâts : ce que ce combat a coûté au matériel. */
  const dmg = S.lastDamage;
  if (dmg){
    const dh = document.createElement("div"); dh.className = "rc-eyebrow"; dh.style.marginTop = "10px";
    dh.textContent = t("dmgTitle"); el.appendChild(dh);
    if (!dmg.rows.length && dmg.chassis < 1){
      const ok = document.createElement("div"); ok.className = "rc-label"; ok.textContent = t("dmgNone");
      el.appendChild(ok);
    } else {
      const ul = document.createElement("div"); ul.className = "rc-dmg";
      for (const r of dmg.rows){
        const li = document.createElement("div"); li.className = "rc-dmg__row";
        const flag = r.tag==="ripped" ? ` <b class="rc-dmg__bad">${t("dmgRipped")}</b>` : (r.hs ? ` <b class="rc-dmg__bad">${t("dmgHS")}</b>` : "");
        li.innerHTML = `${da(t("pn_"+r.id))} <span class="rc-dmg__dw">+${r.dw} %</span>${flag}`;
        ul.appendChild(li);
      }
      if (dmg.chassis >= 1){
        const li = document.createElement("div"); li.className = "rc-dmg__row";
        li.innerHTML = `${t("dmgChassis")} <span class="rc-dmg__dw">+${dmg.chassis} %</span>`;
        ul.appendChild(li);
      }
      el.appendChild(ul);
      if (dmg.est > 0){
        const es = document.createElement("div"); es.className = "rc-label";
        es.textContent = t("dmgRepairEst", {c:dmg.est}); el.appendChild(es);
      }
    }
  }
}
function endToDebrief(){
  cancelAnimationFrame(raf); raf=null;
  const m = match;
  /* S16-CRASH — IDEMPOTENCE. Une frame encore en vol peut rappeler ce
     debrief après un forfait ou un clic rapide : la 2e passe rejouait
     tourResult/recordMatch sur un état déjà consommé (S.tourney=null →
     null.idx, le gel du playtest). Un match ne se débriefe qu'UNE fois. */
  if (m._debriefed) return; m._debriefed = true;
  const won = m.winner === 0;
  renderDebrief(match);
  $("ovTitle").textContent = t(won ? "win" : "lose");
  $("ovTitle").style.color = won ? "var(--good)" : "var(--red)";
  let cause = t(causeKey(m));
  if (wasForfeit) cause = t("forfeited")+" "+cause;
  $("ovCause").textContent = cause;

  // --- bolts ---
  const w = WIN_BOLTS[S.level];
  const exhib = curMode === "exhib";                        // P1-c : libre ET calibrage sont des exhibitions
  let earned;
  if (exhib) earned = 0;                                     // exhibition/calibrage : aucune bourse par manche
  else if (wasForfeit) earned = Math.max(1, Math.ceil(w*0.1));
  else if (won) earned = (curMode==="tour"||curMode==="championnat"||curMode==="bracket") ? Math.ceil(w*0.5) : w;
  else earned = Math.ceil(w*0.25); // tournament losses pay too: the penalty is the restart, not poverty
  S.bolts += earned;
  applyMatchDamage(m);                                       // E3b : l'usure est le résidu du combat
  $("ovDuels").textContent = t("duelsWon",{a:m.duels[0], b:m.duels[1]})
    + (earned ? "   " + t("boltsEarned",{b:earned}) : "");

  // --- progression ---
  const unlockEl = $("ovUnlock"); unlockEl.style.display = "none";
  const realWin = won && !wasForfeit;

  if (curMode === "tour"){
    const r = FORMATS.ladder.tourResult(realWin, w);
    if (r.kind === "next"){
      $("ovMain").textContent = t("tourneyNext", {i:r.i});
    } else if (r.kind === "won"){
      $("ovTitle").textContent = t("tourneyWon")+" 🏅";
      $("ovTitle").style.color = "var(--accent)";
      unlockEl.textContent = t("boltsEarned",{b:r.prize});
      unlockEl.style.display = "block";
      if (r.champion) $("ovCause").textContent = t("championMsg");
      $("ovMain").textContent = t("nextOpp");
    } else { // reroll or lost
      $("ovCause").textContent = t(r.kind==="reroll" ? "tourneyReroll" : "tourneyLost") + " " + cause;
      $("ovMain").textContent = t("retry");
    }
  } else if (curMode === "bracket"){
    /* E4 : flux générique par concours actif (cupM, cupS, …) */
    const bid = curVsConcours, bst = S.concours[bid];
    const done = FORMATS.bracket.recordMatch(bst, realWin);    // win → advance, loss → eliminated
    if (!done){
      $("ovMain").textContent = t("bracketNext", {r: FORMATS.bracket.roundName(bst)});
    } else {
      const pr = FORMATS.bracket.prize(bst, w);
      pr.total = Math.round(pr.total*purseMult(bid));                          // E1 : bourse ×ligue
      S.bolts += pr.total;
      S.concoursDone[bid] = true;                                  // mené à son terme (unlock déclaratif)
      const etoiles = awardStars(bid, rankOfBracket(bst));          // S25
      $("ovTitle").textContent = (pr.champ ? t("bracketChamp") : t("bracketOut")) + " 🏆";
      $("ovTitle").style.color = "var(--accent)";
      unlockEl.textContent = t("bracketPrize", {total:pr.total})
        + (etoiles ? " \u00B7 " + "\u2605".repeat(etoiles) : ""); unlockEl.style.display = "block";
      if (pr.champ && bid === "cupS" && !S.sPrimeAwarded){          // E4 : PRIME DE MONTÉE, une fois
        S.sPrimeAwarded = true; S.bolts += 200; showToast(t("sPrime"));
      }
      S.concours[bid] = null;
      $("ovMain").textContent = t("nextOpp");
    }
  } else if (curMode === "championnat"){
    const cid = curVsConcours, cst = S.concours[cid];
    const done = FORMATS.championnat.recordMatch(cst, m.duels[0], realWin);   // S16-RANK : le RÉSULTAT prime
    const rank = FORMATS.championnat.myRank(cst);
    if (!done){
      $("ovMain").textContent = t("champRound", {r:cst.round+1, n:cst.rounds, rank});
    } else {
      const pr = FORMATS.championnat.prize(cst, w);
      pr.total = Math.round(pr.total*purseMult(cid));                          // E1 : bourse ×ligue
      S.bolts += pr.total;
      S.concoursDone[cid] = true;
      const etoiles = awardStars(cid, pr.rank);                     // S25
      $("ovTitle").textContent = t("champDone")+" 🏁"; $("ovTitle").style.color = "var(--accent)";
      unlockEl.textContent = t("champPrize", {rank:pr.rank, total:pr.total})
        + (etoiles ? " \u00B7 " + "\u2605".repeat(etoiles) : ""); unlockEl.style.display = "block";
      S.concours[cid] = null;
      $("ovMain").textContent = t("nextOpp");
    }
  } else if (curMode === "exhib" && benchmarkOf(curVsConcours)){
    /* CALIBRAGE — ni palmarès ni bourse : l'étalon est une mesure. */
    $("ovMain").textContent = t("calibNote");
  } else { // qual or exhib
    if (realWin){
      // P1-c : seul le qualificatif progresse ; le combat libre ne compte pas au palmarès
      if (curMode === "qual"){ S.beaten++; S.beatenAtLevel++; S.opponent = null; }
      $("ovMain").textContent = t("nextOpp");
    } else {
      if (curMode === "qual" && S.opponent && S.opponent.gen){
        S.opponent.losses = (S.opponent.losses||0) + 1;
        if (S.opponent.losses >= 6){
          S.opponent = null; // pity: he retired from the circuit
          $("ovCause").textContent = t("oppRetired") + " " + cause;
        }
      }
      $("ovMain").textContent = t("retry");
    }
  }
  saveState();
  $("overlay").style.display = "flex";
}

/* ============================================================
   WIRE UP
   ============================================================ */
const TABS = {fight:"fightTab", workshop:"workshopTab", shop:"shopTab"};
/* B1 — pile de navigation. Un écran visible à la fois ; push/back explicites.
   Le retour matériel (Android) suit via popstate ; tout est gardé pour jsdom. */
const NAV = {
  stack: ["homeScreen"],
  reset(){ this.stack = ["homeScreen"]; this.show("homeScreen"); },   // E6
  hist: 0,  // entrées history poussées par nous, pas encore consommées
  eat: 0,   // popstate à ignorer (échos de notre propre history.back())
  show(id){
    for (const sc of ["homeScreen","ligueScreen","chassisScreen","vsScreen","matchScreen"]) $(sc).style.display = (sc===id) ? "block" : "none";
    try{ $("app").classList.toggle("in-match", id==="matchScreen"); }catch(e){}   // P1 : CRT coupé en combat
    $("navBack").style.display = (this.stack.length>1 && id!=="matchScreen") ? "" : "none";
  },
  swap(id){                                   // remplace le sommet (VS → match) sans toucher au miroir history
    this.stack[this.stack.length-1] = id; this.show(id);
  },
  push(id){
    // Pousser l'écran déjà au sommet = remplacement (retry), pas empilement.
    if (this.stack[this.stack.length-1] === id){ this.show(id); return; }
    this.stack.push(id); this.show(id);
    try{ history.pushState({nav:this.stack.length}, ""); this.hist++; }catch(e){}
  },
  back(){
    // Retour TOTAL : quoi qu'il arrive, un écran valide est affiché.
    if (this.stack.length > 1) this.stack.pop();
    else this.stack = ["homeScreen"];
    this.show(this.stack[this.stack.length-1]);
    renderHome();
  },
  homeReset(){                                // onglet cliqué depuis un écran empilé : pile à plat
    const n = this.hist;
    this.stack = ["homeScreen"]; this.show("homeScreen");
    if (n > 0){ this.eat += n; this.hist = 0; try{ history.go(-n); }catch(e){} }
    renderHome();
  },
  uiBack(){
    // Retour déclenché par un bouton : dépile ET consomme l'entrée history miroir.
    this.back();
    if (this.hist > 0){ this.hist--; this.eat++; try{ history.back(); }catch(e){} }
  },
  onPop(){
    // Retour matériel : ignorer les échos de uiBack, sinon dépiler.
    if (this.eat > 0){ this.eat--; return; }
    if (this.hist > 0) this.hist--;
    this.back();
  },
};
try{ window.addEventListener("popstate", ()=>NAV.onPop()); }catch(e){}
$("navBack").onclick = ()=>NAV.uiBack();
let activeTab = "workshop"; // B1 : on démarre au Garage — préparer, puis combattre
function showTab(name){
  activeTab = name;
  for (const [k,id] of Object.entries(TABS))
    $(id).style.display = (k===name) ? "block" : "none";
  $("tabFight").classList.toggle("is-active", name==="fight");
  $("tabWorkshop").classList.toggle("is-active", name==="workshop");
  $("tabShop").classList.toggle("is-active", name==="shop");
}
function goTab(name){                          // P2 : les onglets vivent partout — cliquer = pile à plat + onglet
  if (NAV.stack.length > 1) NAV.homeReset();
  showTab(name);
}
$("tabFight").onclick = ()=> goTab("fight");
$("tabWorkshop").onclick = ()=> goTab("workshop");
$("tabShop").onclick = ()=> goTab("shop");
$("resetLayout").onclick = ()=>{ autoArrangeCurrent(); renderLayerTabs(); };
$("cgToggle").onclick = ()=>{ showCG=!showCG; $("cgToggle").classList.toggle("is-on",showCG); $("cgToggle").textContent=t(showCG?"cgHide":"cgShow"); };
$("hbToggle").onclick = ()=>{ showHB=!showHB; $("hbToggle").classList.toggle("is-on",showHB); $("hbToggle").textContent=t(showHB?"hbHide":"hbShow"); };

$("fightBtn").onclick = ()=>{ try{ startMatch(vsMode || (tournamentOpen() ? "tour" : "qual")); }catch(e){ crashRecover("lancement", e); } };
$("speedBtn").onclick = ()=>{ S.speed = S.speed===1?2:1; saveState();
  $("speedBtn").textContent = "×"+S.speed; };
$("forfeitBtn").onclick = ()=>{
  if (!match || match.over) return;
  wasForfeit = true;
  while(!match.over) ENGINE.tick(match);
  cancelAnimationFrame(raf);
  endToDebrief();
};
$("ovMain").onclick = ()=>{
  try{                                       // S16-CRASH : la revanche ne fige plus jamais l'ecran
    $("overlay").style.display="none";
    const realWin = match.winner === 0 && !wasForfeit;
    const goHome = ()=>NAV.uiBack();
    /* S38-HUB — un championnat EN COURS reboucle sur son hub (écran VS) pour la
       manche suivante : on regénère l'adversaire et on remplace l'écran de match
       par le hub (swap, l'historique reste propre). Saison finie (CN nul, posé au
       débrief) → retour à la ligue. Les autres formats gardent leur routage. */
    if (curMode === "championnat" && curVsConcours && CN(curVsConcours)){
      vsOpp = makeOpponent(vsMode); NAV.swap("vsScreen"); renderVsScreen();
    }
    else if (realWin) goHome();               // scout the next opponent / bracket match
    else if (curMode === "exhib") goHome();   // lost friendly: no forced rematch loop
    else if (curMode === "championnat") goHome();  // saison terminée → retour ligue
    else if (curMode === "bracket") goHome(); // bracket: win→next round, loss→eliminated
    else startMatch(curMode);                 // retry (tournament restarts at match 1)
  }catch(e){ crashRecover("revanche", e); }
};
$("ovBack").onclick = ()=>{ $("overlay").style.display="none"; NAV.uiBack(); };
/* P2 — panneau de reglages : langue + comparatif de versions */
/* S37-MENU — une seule app, une seule colonne. Le comparatif PWA/Single-file
   melait produit et musee, et poussait le journal d'erreurs hors ecran. */
function renderVersionsTable(){
  const tb = $("verTable"); if(tb){ tb.innerHTML = "";
    const cache = "v89";                                      // repere de build (CACHE du SW — garder synchro avec sw.js)
    const rows = [[t("verRow_build"), cache],
                  [t("verRow_save"), "v"+SAVE_V+" · "+t("verSaveV4")],
                  [t("verRow_off"), "✓"],
                  [t("verRow_maj"), "✓"]];
    rows.forEach(r=>{ const tr=document.createElement("tr");
      const th=document.createElement("th"); th.textContent=r[0]; tr.appendChild(th);
      const td=document.createElement("td"); td.textContent=r[1]; tr.appendChild(td);
      tb.appendChild(tr); }); }
  const te = $("errTable");
  if(te){ te.innerHTML = "";
    const log = errlog();
    if(!log.length){ const tr=document.createElement("tr");
      const td=document.createElement("td"); td.textContent=t("errNone");
      tr.appendChild(td); te.appendChild(tr); }
    for (const e of log.slice(0,5)){ const tr=document.createElement("tr");
      for(const v of [e.t.slice(5,16), e.msg.slice(0,52), e.at]){
        const td=document.createElement("td"); td.textContent=v; tr.appendChild(td); }
      te.appendChild(tr); } }
}
$("settingsBtn").onclick = ()=>{ renderVersionsTable(); $("settingsOv").style.display="flex"; };
if($("errClear")) $("errClear").onclick = ()=>{ try{ localStorage.removeItem(ERRLOG_KEY); }catch(_){} renderVersionsTable(); };
/* MAJ FORCÉE — le SW est cache-first (ignoreSearch), donc une simple actualisation
   peut resservir l'ancien build. Ce bouton PURGE les caches + désinscrit le SW,
   puis recharge : index.html réenregistre sw.js qui reprécache le build courant.
   La sauvegarde vit dans localStorage (intacte). */
async function forcePwaUpdate(){
  try{ showToast(t("updating"), 4000); }catch(_){}
  try{ if (window.caches){ const ks = await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); } }catch(_){}
  try{ if (navigator.serviceWorker){ const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r=>r.unregister())); } }catch(_){}
  try{ location.reload(); }catch(_){ try{ location.href = location.pathname; }catch(__){} }
}
if($("forceUpdate")) $("forceUpdate").onclick = forcePwaUpdate;
$("settingsClose").onclick = ()=>{ $("settingsOv").style.display="none"; };

/* ══ E6 — écran d'accueil : carrières ══ */
function renderWelcome(){
  const list = $("careerList"); if(!list) return;
  list.innerHTML = "";
  const cs = careersList();
  for (const c of cs){
    const card = document.createElement("div");
    card.className = "rc-career" + (c.n === CUR_CAREER ? " is-active" : "");
    const th = document.createElement("div"); th.className = "rc-career__thumb";
    th.appendChild(tileCanvas(64, (x)=>drawBotThumb(x, c.chassis, c.color||null, 64, c.bot||null)));
    card.appendChild(th);
    const info = document.createElement("div"); info.className = "rc-career__info";
    info.innerHTML = `<div class="rc-name"></div>
      <div class="rc-label">${t("careerMeta",{lv:c.level+1, b:c.bolts, w:c.beaten})}</div>`;
    info.querySelector(".rc-name").textContent = da(c.name);   // A2 : le nom (saisie joueur) n'est JAMAIS interprété comme HTML
    card.appendChild(info);
    const del = document.createElement("button"); del.className = "rc-iconbtn rc-career__del";
    del.textContent = "\u2715";
    del.onclick = (ev)=>{ ev.stopPropagation();
      if (del._armed){ deleteCareer(c.n); renderWelcome(); }
      else { del._armed = true; del.classList.add("is-armed"); setTimeout(()=>{ del._armed=false; del.classList.remove("is-armed"); }, 2200); } };
    card.appendChild(del);
    card.onclick = ()=>{ loadCareerState(c.n); hideWelcome(); };
    list.appendChild(card);
  }
  const full = cs.length >= CAREER_MAX;
  $("careerNew").disabled = full;
  $("careerName").style.display = full ? "none" : "";
  $("careerName").placeholder = t("careerNamePh");
  $("welcomeBack").style.display = CUR_CAREER ? "" : "none";
  tilesDirty();
}
function showWelcome(){ $("welcomeOv").style.display = "flex"; renderWelcome(); }
/* ══ E9 — cérémonie de remise d'un châssis (réutilisée à chaque achat) ══ */
let _recvNext = null;
/* S36-CEREMONIE — la remise dessinait `drawBotThumb(c, chassis, null, 256)` :
   SANS bot, donc la coque nue. Pour un achat de coque c'est juste (on achete
   bien une coque), mais le bot OFFERT au depart et le bot d'occasion sont des
   bots ASSEMBLES : on les presentait deshabilles. Le parametre `bot` est
   optionnel — les appelants qui remettent une coque nue ne changent pas. */
function showBotReceived(chassis, label, sub, next, bot){
  const ov = $("botRecvOv"); if (!ov){ if (next) next(); return; }
  _recvNext = next || null;
  $("recvEyebrow").textContent = t("recvEyebrow");
  $("recvName").textContent = da(label || chassisName(chassis));
  $("recvSub").textContent = sub || (t("classe") + " " + chassisClassOf(chassis));
  const cv = $("recvCv"), c = cv.getContext("2d");
  c.clearRect(0,0,256,256);
  drawBotThumb(c, chassis, (bot && bot.customize && bot.customize.color) || null, 256, bot || null);
  ov.style.display = "flex";
  const card = ov.querySelector(".rc-recv");
  card.classList.remove("rc-recv--in"); void card.offsetWidth;   // relance l'animation
  card.classList.add("rc-recv--in");
}
if ($("recvGo")) $("recvGo").onclick = ()=>{ $("botRecvOv").style.display = "none";
  const n = _recvNext; _recvNext = null; if (n) n(); };
/* ══ E9 — intro de nouvelle partie ══ */
function showIntro(next){
  const ov = $("introOv"); if (!ov){ if (next) next(); return; }
  $("introBody").innerHTML = t("introBody");
  ov.style.display = "flex";
  $("introGo").onclick = ()=>{ ov.style.display = "none"; if (next) next(); };
}

function hideWelcome(){ $("welcomeOv").style.display = "none"; }
if ($("careerNew")) $("careerNew").onclick = ()=>{
  const n = createCareer(($("careerName").value||"").trim());
  if (n){ $("careerName").value=""; hideWelcome(); } };
if ($("welcomeBack")) $("welcomeBack").onclick = hideWelcome;
/* P-FICHE — échange de bots depuis les réglages. Le presse-papier n'est pas
   toujours disponible (http non sécurisé, WebView) : on écrit TOUJOURS la
   fiche dans la zone de texte, la copie n'est qu'un confort en plus. */
if ($("ficheExport")) $("ficheExport").onclick = ()=>{
  const txt = JSON.stringify(exportBot());
  $("ficheBox").value = txt;
  $("ficheBox").select?.();
  try { navigator.clipboard?.writeText(txt); } catch(e){}
  showToast(t("botCopied"));
};
if ($("ficheImport")) $("ficheImport").onclick = ()=>{
  const bot = importBot(($("ficheBox").value || "").trim());
  if (!bot){ showToast(t("botBadJson")); return; }
  $("settingsOv").style.display = "none";
  showTab("workshop"); renderHome();
  showToast(t("botImported", { name: dataName((CHASSIS_INFO[bot.chassis]||{}).name) || bot.chassis }));
};
if ($("settingsCareers")) $("settingsCareers").onclick = ()=>{ $("settingsOv").style.display="none"; showWelcome(); };
if (!CUR_CAREER) showWelcome();                                     // premier lancement : accueil
document.querySelectorAll("#langSeg .rc-seg__opt").forEach(o=>{
  o.onclick = ()=>{ LANG = o.dataset.lang; S.lang = LANG; document.documentElement.lang = LANG; saveState(); renderHome(); };
});
window.addEventListener("resize", ()=>{ if (match && !match.over) setupCanvas(); anchorVs(); });  // S16-UI : le VS se recale

/* [2] Préchargement : réchauffe les caches d'images existants au démarrage,
   au lieu d'attendre le premier dessin de chaque tuile. Première visite
   (SW absent) : les onload de mkImg redessinent à l'arrivée réseau. */
function preloadSprites(){
  if (typeof Image==="undefined") return;
  for (const slot in COMPONENT_SPRITES) for (const id in COMPONENT_SPRITES[slot]) componentSprite(slot, id);
  for (const id in ARMOR_SPRITES) armorSprite(id);
  for (const ch in CHASSIS_SPRITES) spriteState(ch);
  for (const st of STICKERS) stickerImg(st.id);
  for (const v of VSTICKERS) stickerImg(v.id);
}
preloadSprites();
document.documentElement.lang = LANG;   // i18n : <html lang> suit la langue au démarrage
renderHome();
if (SAVE_RESET_NOTICE){ SAVE_RESET_NOTICE = false; try { showToast(t("saveReset")); } catch(_){} }   // Phase 3 : reset EXPLICITE
showTab(activeTab);
