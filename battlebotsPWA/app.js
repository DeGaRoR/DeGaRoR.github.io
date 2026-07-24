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
const da = (s) => typeof s === "string" ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : s;
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
   Politique pré-release : pas de migration — toute sauvegarde d'une autre
   version ou invalide est écartée et remplacée (validState). */
const SAVE_V = 4;
// a chassis is valid only if the engine knows it; unknown → fall back rather than crash.
function validChassis(ch){ return (ch && ENGINE.PHYS.chassis[ch] && ENGINE.CHASSIS[ch]) ? ch : "boxy"; }
const DEF_SLOT = {};                        // def -> slot d'appartenance (catalogue)
for (const sl in ENGINE.PARTS) for (const p of ENGINE.PARTS[sl]) DEF_SLOT[p.id] = sl;
const BASE_KIT = { propulsion:"pr0", motor:"m0", cpu:"c0", battery:"b0", sensors:"n0" }; // kit de tout châssis neuf
const BOLT_SVG = '<svg width="11" height="11" viewBox="0 0 12 12" style="vertical-align:-1px"><polygon points="6,1 10.5,3.5 10.5,8.5 6,11 1.5,8.5 1.5,3.5" fill="currentColor"/></svg>';
function mintInto(inv, def, extra){ const uid = "i"+(++inv.seq);
  inv.items[uid] = Object.assign({ def, wear:0 }, extra||{}); return uid; }
function bareBot(chassis){
  return { chassis: validChassis(chassis), fit:{},
    customize:{ color:"#d98a45", stickers:[], placed:[] }, layout:null,   // jaune-orangé d'usine (= DEFAULT_CHASSIS_COLOR, littéral : TDZ)
    equipped:{}, counts:{} }; }             // caches (voir refit)
function newBotInto(inv, chassis){
  const b = bareBot(chassis);
  for (const sl in BASE_KIT) b.fit[sl] = [ mintInto(inv, BASE_KIT[sl]) ];
  return b; }
function defaultState(){
  const inv = { seq:0, items:{} };
  const bot = newBotInto(inv, "boxy");
  return {
    v: SAVE_V,
    lang:"fr", beaten:0, speed:1,           // beaten = qualifier+friendly wins (param unlocks)
    level:1, beatenAtLevel:0,               // 2 qualifier wins open the tournament
    bolts:0,
    inv, garage:[bot], activeBot:0,
    badges:[], champion:false,
    tourney:null,                           // {idx, opponents:[{name,archetype,build,level}x3]}
    concours:{},                            // progression par concours engagé (id → état de format, + lock éventuel)
    concoursDone:{},                        // concours menés à leur terme (unlock déclaratif)
    settings:{...ENGINE.SLICE1.playerBuild},
    opponent:null,                          // current qualifier {name, archetype, build, level}
  };
}
/* validState — rejet des schémas étrangers/invalides (remplace les migrations).
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

let S = defaultState();
try {
  const raw = localStorage.getItem(SKEY);
  if (raw){
    const cand = JSON.parse(raw);
    if (validState(cand)) S = {...defaultState(), ...cand};
    /* sinon : schéma d'une autre version ou invalide → état neuf, sauvegarde
       écrasée à la prochaine écriture. Politique pré-release, pas de migration. */
  }
} catch(e){}
S.garage.forEach(b => refit(b));
if (S.activeBot==null || S.activeBot>=S.garage.length) S.activeBot=0;
S.garage.forEach(b=>{ b.chassis = validChassis(b.chassis); });
S.concours = (S.concours && typeof S.concours === "object") ? S.concours : {};
S.concoursDone = (S.concoursDone && typeof S.concoursDone === "object") ? S.concoursDone : {};
for (const cid in S.concours){ const st = S.concours[cid];
  if (st && st.lock) st.lock.chassis = validChassis(st.lock.chassis); }
/* A2 — SAVE_V et validState sont déclarés en tête d'état. Les migrations
   ont été retirées (décision : pré-release, joueur unique) — une sauvegarde
   d'une autre version est écartée, jamais transformée ni rétrogradée. */
/* P-PLAN-UNIQUE : purge du blindage monté des états adoptés (données du
   slot conservées pour le chantier plaques latérales). */
(function retireArmor(){
  if (S.parts && S.parts.equipped && S.parts.equipped.armor) S.parts.equipped.armor = null;
  if (S.garage) for (const b of S.garage){
    if (b.fit && b.fit.armor){ for (const u of b.fit.armor) delete S.inv.items[u]; delete b.fit.armor; }
    if (b.equipped && b.equipped.armor) b.equipped.armor = null;
  }
})();
syncActive(); recomputeOwned();
function saveState(){ try{ localStorage.setItem(SKEY, JSON.stringify(S)); }catch(e){} }
LANG = S.lang;

/* E1 : le barème vit dans data.js (WIN_EUR). Alias local pour les lecteurs. */
const WIN_BOLTS = WIN_EUR;
// software (behaviour pack) unlocks pilot controls gradually: s0 basics, s1 approach/charge, s2 handling/strategy.
const CONTROL_TIER = { aggression:0, edgeGuard:0, approach:1, chargeDist:1, handling:2, strategy:2, power:0 };
function ownedSwTier(){ const o=(S.parts&&S.parts.owned&&S.parts.owned.software)||["s0"]; return o.includes("s2")?2:o.includes("s1")?1:0; }
const isUnlocked = (key)=>{ const n=CONTROL_TIER[key]; return n==null || ownedSwTier()>=n; };
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
    const g = ENGINE.genOpponent(Math.floor(Math.random()*1e9), S.level);
    S.opponent = { name:pickName(), archetype:g.archetype, build:g.build, level:S.level,
      gen:true, losses:0 };
  }
  saveState();
}

function ensureTourney(){
  if (S.tourney) return;
  const seed = Math.floor(Math.random()*1e9);
  const opps = ENGINE.genTournament(seed, S.level);
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
  const myBuild = {...S.settings, chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}, color:S.customize.color, stickers0:S.customize.placed};
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
  if ($("vsScreen").style.display === "block") renderVsScreen();
  renderBracketView();
  renderChampStandings();
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
      sw.onclick=()=>{ S.customize.color=col; saveState(); renderCustomize(); };
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
  if (!unlocked){
    if (S.settings[key] !== ENGINE.OPTS[key][0]) S.settings[key] = ENGINE.OPTS[key][0];
    return null;
  }
  const field = document.createElement("div"); field.className = "rc-field";
  const head = document.createElement("div"); head.className = "rc-field__head";
  head.innerHTML = `<span>${t(key)}</span>
    <span class="rc-field__val">${t(S.settings[key])}</span>`;
  field.appendChild(head);
  const seg = document.createElement("div"); seg.className = "rc-seg";
  for (const opt of ENGINE.OPTS[key]){
    const o = document.createElement("div");
    o.className = "rc-seg__opt" + (S.settings[key]===opt ? " is-active" : "");
    o.textContent = t(opt);
    o.onclick = ()=>{ if(!isUnlocked(key)) return; S.settings[key]=opt; saveState(); renderHome(); };
    seg.appendChild(o);
  }
  field.appendChild(seg);
  return field;
}

// part effect summary, generated from the catalog (always accurate)
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
const CHASSIS_COLORS = ["#59627a","#4f83c9","#c9584f","#4fa86b","#d98a45",
  "#9377cc","#3fa8a0","#cfa64f","#c9628f","#8a93a5","#d9c85a","#5566a8","#e8e8e8"];
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

/* ============================================================
   ROBOT EDITOR — Pass 1: 4-level spatial model on a shared grid.
   The grid is larger than the starter chassis (room to grow; the view
   zooms to the active chassis). Levels: CHASSIS (propulsion, symmetric,
   mounted on the hull), INTERNAL (contained in the hull), ARMOR (a shell
   that traces the outline), EXTERNAL (may overhang if anchored on the hull).
   Footprints vary by tier — a bigger battery/motor/drivetrain forces a
   re-pack. Auto-arrange keeps a legal layout so you never get stuck.
   ============================================================ */

// chassis outline: half-width per row over a centred sub-region (room to spare)

// Pass 2: internal FLOORS per chassis. A wide hull (boxy) uses one low floor;
// narrow hulls (wedge/dart) get a 2nd floor — more room, but a higher stack
// (→ higher CG, easier to flip: the trade-off the CG pass will read).
const FLOOR_H = 3; // cm of elevation added per internal floor (feeds CG in Pass 3)
function floorsOf(chassis){ return 1; } // P-PLAN-UNIQUE : une nappe (INTERNAL_FLOORS dort)
function chassisHalf(chassis,row){ const s=CHASSIS_SPEC[chassis]||CHASSIS_SPEC.boxy;
  if(row<s.front||row>s.rear) return -1;
  const tt=(row-s.front)/Math.max(1,(s.rear-s.front));
  return s.hFront + (s.hRear-s.hFront)*tt; }
function cellInChassis(chassis,col,row){ if(col<0||row<0||col>=gridW(chassis)||row>=gridH(chassis)) return false;
  const sp=CHASSIS_SPEC[chassis];
  if(sp&&sp.mask){ const r=sp.mask[row]; return !!(r && r[col]==="#"); }   // mask-based hull
  const h=chassisHalf(chassis,row); return h>=0 && Math.abs((col+0.5)-gridCX(chassis)) <= h; }
function chassisBounds(chassis){ const GW=gridW(chassis),GH=gridH(chassis); let minC=GW,maxC=-1,minR=GH,maxR=-1;
  for(let r=0;r<GH;r++)for(let c=0;c<GW;c++)if(cellInChassis(chassis,c,r)){
    minC=Math.min(minC,c);maxC=Math.max(maxC,c);minR=Math.min(minR,r);maxR=Math.max(maxR,r);}
  return {minC,maxC,minR,maxR}; }

// ---- footprint bank: base (w×d cells, height cm) + per-tier overrides ----
const FOOT_BASE = {
  // propulsion is ONE SIDE (a wheel or track); it is mirrored L/R at placement.
  // Sizes are deliberately CHUNKY: packing is a real puzzle, and the biggest
  // parts do NOT all fit a starter hull — bigger chassis (weight classes) will.
  propulsion:{w:1,d:2,h:6}, motor:{w:1,d:1,h:4}, battery:{w:2,d:1,h:3}, cpu:{w:1,d:1,h:1.5},
  cooling:{w:1,d:1,h:4}, ballast:{w:1,d:1,h:3}, srimech:{w:1,d:1,h:4},
  sensors:{w:1,d:1,h:6}, weapon1:{w:3,d:3,h:6}, weapon2:{w:3,d:3,h:6},
};
const FOOT_TIER = {
  propulsion:{ pr1:{w:1,d:4}, pr2:{w:2,d:3}, pr3:{w:2,d:5} },  // per side: more wheels / a track
  battery:{ b1:{w:2,d:2}, b2:{w:4,d:2}, b3:{w:5,d:3} },
  motor:{ m1:{w:2,d:2}, m2:{w:2,d:2}, m3:{w:3,d:2}, m4:{w:3,d:3} },
  cpu:{ c2:{w:2,d:1} },
  cooling:{ k1:{w:2,d:2}, k2:{w:3,d:3} },
  ballast:{ l2:{w:2,d:1} },
  sensors:{ n2:{w:2,d:1} },
  srimech:{ r1:{w:2,d:2}, r2:{w:3,d:2} },
};
function baseSlot(slot){ const i=slot.indexOf("#"); return i<0 ? slot : slot.slice(0,i); } // "motor#1" → "motor"
function footprintOf(slot,id){ slot=baseSlot(slot); const b=FOOT_BASE[slot]||{w:1,d:1,h:1};
  const o=(FOOT_TIER[slot]&&FOOT_TIER[slot][id])||{}; return {w:o.w||b.w, d:o.d||b.d, h:b.h}; }
function mirrorCol(chassis,col,w){ return 2*gridCX(chassis) - col - w; } // reflect about the chassis axis

// ---- 4 levels. armor is a shell (traces the outline), not a placed footprint ----
/* P-PLAN-UNIQUE — un bot est UNE nappe : structure (châssis+propulsion) et
   équipement (tout le reste, capteurs et armes comprises) partagent le même
   plan de collision. Plus d'étages, plus de couche blindage (les plaques
   latérales reviendront au chantier armes, comme pièces d'équipement de
   périmètre). Capteurs/armes gardent le droit de DÉBORDER de la coque —
   c'est la définition même de l'exposition (E3). */
const EDIT_LAYERS = [
  { id:"structure",  elev:1, slots:["propulsion"] },
  { id:"equipement", elev:4, slots:["motor","battery","cpu","cooling","ballast","srimech","sensors","weapon1","weapon2"] },
];
const PROTRUDE_OK = { sensors:1, weapon1:1, weapon2:1 };   // ancrés, débord autorisé
const STICKER_LAYER = 2; // pseudo-calque : décalcos libres
const NONE_AT_0 = { weapon1:1, weapon2:1, ballast:1, srimech:1, sensors:1 };
function isMounted(slot, id){ // E4 : tout slot "aucun" (index 0) n'occupe AUCUNE cellule
  if(!NONE_AT_0[slot]) return true;
  return ENGINE.PARTS[slot].findIndex(p=>p.id===id) > 0; }
const PLACED_SLOTS = EDIT_LAYERS.flatMap(L=>L.slots);
const SLOT_LAYER = {}; EDIT_LAYERS.forEach((L,i)=>L.slots.forEach(s=>SLOT_LAYER[s]=i));
// ---- L3.5 multiplicity: internal slots can hold N instances (motor#0, motor#1, …) ----
// (STACK_SLOTS is declared earlier — installedElsewhere() reads it during boot)
function countOf(build, slot){ const b=baseSlot(slot);
  return (build.counts && STACK_SLOTS[b]) ? Math.max(1, build.counts[b]|0) : 1; }
function instanceSlots(build){ const out=[];        // internal layer, expanded by counts
  for(const slot of EDIT_LAYERS[1].slots){ const n=countOf(build, slot);
    out.push(slot); for(let i=1;i<n;i++) out.push(slot+"#"+i); } return out; }
function idAt(build, slot){ const b=baseSlot(slot); return (build.parts&&build.parts[b])||ENGINE.PARTS[b][0].id; }
function layerOf(slot){ return SLOT_LAYER[baseSlot(slot)]; }
function placedSlotsOf(build){ return [...EDIT_LAYERS[0].slots, ...instanceSlots(build)]; }
function tierColor(slot,id){ const i=ENGINE.PARTS[slot].findIndex(p=>p.id===id);
  return TIER_COLORS[Math.max(0,Math.min(TIER_COLORS.length-1,i))]; }
function mixHex(a,b,t){
  const pa=[parseInt(a.slice(1,3),16),parseInt(a.slice(3,5),16),parseInt(a.slice(5,7),16)];
  const pb=[parseInt(b.slice(1,3),16),parseInt(b.slice(3,5),16),parseInt(b.slice(5,7),16)];
  return "#"+pa.map((v,i)=>Math.round(v+(pb[i]-v)*t).toString(16).padStart(2,"0")).join(""); }

// ---- placement rules & auto-arrange ----
function rectsOverlap(a,fa,b,fb){
  return a.col < b.col+fb.w && a.col+fa.w > b.col && a.row < b.row+fb.d && a.row+fa.d > b.row; }
function cellsOfFoot(pos,f){ const out=[]; for(let dc=0;dc<f.w;dc++)for(let dr=0;dr<f.d;dr++) out.push([pos.col+dc,pos.row+dr]); return out; }
function fullyContained(chassis,pos,f){ return cellsOfFoot(pos,f).every(([c,r])=>cellInChassis(chassis,c,r)); }
function anchoredOnChassis(chassis,pos,f){
  const cells=cellsOfFoot(pos,f);
  if(!cells.every(([c,r])=>c>=0&&r>=0&&c<gridW(chassis)&&r<gridH(chassis))) return false;   // in the grid
  return cells.some(([c,r])=>cellInChassis(chassis,c,r)); }                  // ≥1 cell on the hull
// propulsion may sit ON the hull OR flush against its edge (adjacent, no overlap),
// but not floating away — at least one cell must touch a hull cell.
function touchesChassis(chassis,pos,f){
  const cells=cellsOfFoot(pos,f);
  if(!cells.every(([c,r])=>c>=0&&r>=0&&c<gridW(chassis)&&r<gridH(chassis))) return false;   // in the grid
  return cells.some(([c,r])=> cellInChassis(chassis,c,r)
    || cellInChassis(chassis,c-1,r) || cellInChassis(chassis,c+1,r)
    || cellInChassis(chassis,c,r-1) || cellInChassis(chassis,c,r+1)); }
function noOverlap(pos,f,others){ return others.every(o=>!rectsOverlap(pos,f,o,o.f)); }
function placementOK(chassis, slot, pos, others){
  const f=footprintOf(slot, curId(slot));
  if(SLOT_LAYER[slot]===0){ // propulsion (left side); right side is its mirror
    if(pos.col + f.w > gridCX(chassis)) return false;          // left side stays left of the axis
    const mc=mirrorCol(chassis,pos.col,f.w);
    return touchesChassis(chassis,pos,f) && touchesChassis(chassis,{col:mc,row:pos.row},f); // adjacent or on-hull
  }
  const geom = PROTRUDE_OK[baseSlot(slot)]
    ? anchoredOnChassis(chassis,pos,f)
    : fullyContained(chassis,pos,f);
  return geom && noOverlap(pos,f,others);            // plan unique : `others` = TOUT l'équipement + roues
}
/* les roues occupent leurs cellules DES DEUX côtés (miroir) dans le bassin */
function propulsionRects(build, layout){
  const p = layout && layout.propulsion; if(!p) return [];
  const f = footprintOf("propulsion", idAt(build,"propulsion"));
  const mc = mirrorCol(build.chassis, p.col, f.w);
  return [{...p, f}, {col:mc, row:p.row, f}];
}
function curId(slot){ return (S.parts&&S.parts.equipped&&S.parts.equipped[slot]) || ENGINE.PARTS[slot][0].id; }
function firstFit(chassis, f, others, mode){ // mode: "contain" | "anchor"
  for(let row=0; row<gridH(chassis); row++) for(let col=0; col<gridW(chassis); col++){
    const pos={col,row};
    const geomOK = mode==="contain" ? fullyContained(chassis,pos,f) : anchoredOnChassis(chassis,pos,f);
    if(geomOK && noOverlap(pos,f,others)) return pos;
  }
  return null;
}
function autoArrange(build){
  /* E4 — arrangeur explorateur : la rangée de roues est CHERCHÉE (les roues
     peuvent s'affleurer hors coque, touchesChassis le permet) et on retient la
     première rangée où TOUT l'équipement loge. Sinon __nofit — plus jamais de
     repli chevauchant silencieux. */
  const chassis=build.chassis, L={};
  const idOf=(slot)=>idAt(build,slot);
  const fP=footprintOf("propulsion", idOf("propulsion"));
  const eqList=instanceSlots(build).sort((a,b)=>{
    const fa=footprintOf(a,idOf(a)), fb=footprintOf(b,idOf(b));
    return fb.w*fb.d - fa.w*fa.d; });
  const tryWith=(prow)=>{
    const T={};
    let pcol=-1;
    for(let cc=0; cc+fP.w<=gridCX(chassis); cc++){
      const mc=mirrorCol(chassis,cc,fP.w);
      if(touchesChassis(chassis,{col:cc,row:prow},fP) && touchesChassis(chassis,{col:mc,row:prow},fP)){ pcol=cc; break; } }
    if(pcol<0) return null;
    T.propulsion={col:pcol,row:prow};
    const pool=propulsionRects(build, T);
    for(const slot of eqList){
      if(!isMounted(baseSlot(slot), idOf(slot))){ T[slot]={col:0,row:0}; continue; }
      const f=footprintOf(slot,idOf(slot));
      const mode = PROTRUDE_OK[baseSlot(slot)] ? "anchor" : "contain";
      const pos=firstFit(chassis, f, pool, mode);
      if(!pos) return null;
      T[slot]={...pos}; pool.push({...pos,f});
    }
    return T;
  };
  const GH=gridH(chassis);
  for(let prow=0; prow+fP.d<=GH; prow++){
    const T=tryWith(prow);
    if(T){ Object.assign(L,T); return L; }
  }
  L.__nofit = true;
  L.propulsion={col:0,row:Math.max(0,gridH(chassis)-fP.d)};
  for(const slot of eqList) L[slot]={col:0,row:0};
  return L;
}
function layoutValid(build, layout){ // every placed slot legal for THIS build/chassis
  if(!layout) return false;
  const SLOTS=placedSlotsOf(build);
  for(const slot of SLOTS){ if(!layout[slot]) return false; }
  const idFor=(o)=> idAt(build, o);
  for(const slot of SLOTS){
    if(!isMounted(baseSlot(slot), idFor(slot))) continue;       // ghosts don't need a legal spot
    const p=layout[slot];
    const others=SLOTS.filter(o=>o!==slot && layerOf(o)===1 && layerOf(slot)===1
        && isMounted(baseSlot(o), idFor(o)))
      .map(o=>({...layout[o], f:footprintOf(o, idFor(o))}))
      .concat(layerOf(slot)===1 ? propulsionRects(build, layout) : []);
    // temporarily evaluate with the equipped id of THIS slot
    const f=footprintOf(slot, idFor(slot));
    const li=layerOf(slot);
    const flOK = (p.floor||0) === 0;                 // plan unique : plus d'étages
    let geomOK, symOK=true;
    if(li===0){ // propulsion: left side left of axis, both mirrored sides mount
      symOK = p.col + f.w <= gridCX(build.chassis);
      geomOK = touchesChassis(build.chassis,p,f) && touchesChassis(build.chassis,{col:mirrorCol(build.chassis,p.col,f.w),row:p.row},f);
    } else if(li===1){ geomOK = PROTRUDE_OK[baseSlot(slot)]
        ? anchoredOnChassis(build.chassis,p,f)
        : fullyContained(build.chassis,p,f); }
    else { geomOK = anchoredOnChassis(build.chassis,p,f); }
    if(!(geomOK && symOK && flOK && noOverlap(p,f,others))) return false;
  }
  return true;
}
function getLayout(){ // player layout, auto-repaired if stale/illegal
  const build={chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}};
  if(AB().layout && layoutValid(build, AB().layout)) return AB().layout;
  const L=autoArrange(build); AB().layout=L; return L;
}

// ---- per-component hitbox (WYSIWYG collision) ----
// The hull is PAVED with one small circle per occupied cell, so the union hugs
// exactly the drawn footprint (chassis + wheels + overhangs) instead of ballooning.
// Local coords are (forward, lateral) vs the bot's facing; each circle is tagged
// with its slot, paving the way for per-part damage and live tear-off.
const CELL_PX = 6.2; // board units per grid cell (3 cm) — SAME for every chassis (cell-true)
function colliderVis(chassis){ return CELL_PX / viewParams(chassis).cell; }
// ---- RUSTY chassis sprite (white plate, colourised via multiply) ----


/* [2] Chargement robuste des sprites.
   mkImg : toute image notifie son arrivée → les tuiles statiques se redessinent.
   TILE_REG : canvases dessinés une seule fois (boutique, occasion, vignettes bots),
   ré-exécutés à l'arrivée d'une image, débouncé sur une frame, purgé si détaché. */
const TILE_REG = new Set();
let _tilesRaf = 0;
function tilesDirty(){
  if(_tilesRaf || typeof requestAnimationFrame==="undefined") return;
  _tilesRaf = requestAnimationFrame(()=>{ _tilesRaf=0;
    for(const cv of [...TILE_REG]){
      if(!cv.isConnected){ TILE_REG.delete(cv); continue; }
      cv._draw();
    } });
}
function regTile(cv, draw){ cv._draw=draw; TILE_REG.add(cv); draw(); tilesDirty(); }
/* la repasse rAF retombe APRÈS insertion : clientWidth réel, backing net */
/* B1 — plus de constantes de backing bricolées : tileCanvas dessine en
   coordonnées logiques, et cale le backing sur la taille CSS RÉELLE × dpr
   à chaque redraw (tilesDirty repasse après insertion et au resize).
   Un seul rééchantillonnage : sprite source → pixels physiques. */
function tileCanvas(logical, drawFn){
  const cv = document.createElement("canvas");
  cv.width = cv.height = logical*2;                       // amorce avant insertion
  regTile(cv, ()=>{
    const dpr = window.devicePixelRatio || 1;
    const px = Math.max(logical, Math.round((cv.clientWidth || logical)*dpr));
    if (cv.width !== px){ cv.width = px; cv.height = px; }
    const c = cv.getContext("2d");
    c.setTransform(px/logical, 0, 0, px/logical, 0, 0);
    c.clearRect(0, 0, logical, logical);
    drawFn(c);
  });
  return cv;
}
function mkImg(src){
  if(typeof Image==="undefined") return null;
  const im = new Image();
  im.onload = ()=>tilesDirty();
  im.src = src;
  return im;
}
const arenaImg = mkImg(ARENA_SRC);
/* S11b — arènes par concours : chaque entrée de TOURNAMENTS peut préciser
   `arena:"assets/arena_x.webp"` ; défaut = ARENA_SRC. Cache d'images partagé. */
const ARENA_IMGS = {};
function arenaFor(src){ const k = src || ARENA_SRC;
  return ARENA_IMGS[k] || (ARENA_IMGS[k] = (k===ARENA_SRC ? arenaImg : mkImg(k))); }
/* S11c — le rendu du bot passe par un canvas de travail : le MÊME composite
   sert au bot et à sa silhouette d'ombre (drop shadow exacte, éléments
   individuels compris ; le retournement et la culbute y sont déjà cuits). */
const BOT_SCRATCH = {};
function renderBotComposite(bot, layout, flipped, fa){
  const vis = colliderVis(bot.build.chassis);
  const S = Math.ceil(bot.radius*2.9 + 34), Q = 2;
  let sc = BOT_SCRATCH[bot.id];
  if (!sc || sc.cv.width !== S*Q){
    sc = BOT_SCRATCH[bot.id] = { cv:document.createElement("canvas"), sil:document.createElement("canvas") };
    sc.cv.width = sc.cv.height = sc.sil.width = sc.sil.height = S*Q;
  }
  const c = sc.cv.getContext("2d");
  c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,S*Q,S*Q);
  c.setTransform(Q,0,0,Q,S*Q/2,S*Q/2);
  c.rotate(Math.PI/2); c.scale(vis, vis);
  if (fa > 0){ const k = Math.cos((1-fa)*Math.PI); c.scale(1, Math.max(0.08, Math.abs(k))); }
  if (flipped){ c.rotate(Math.sin(match.t*9 + bot.id)*0.06); c.scale(1,-1); }
  drawBotTiles(c, bot.build, layout, wheelPhase[bot.id], {shadow:false, slip:slipR[bot.id], bellyUp:flipped});
  const s2 = sc.sil.getContext("2d");
  s2.setTransform(1,0,0,1,0,0); s2.clearRect(0,0,S*Q,S*Q);
  s2.drawImage(sc.cv, 0, 0);
  s2.globalCompositeOperation = "source-in";
  s2.fillStyle = "#000"; s2.fillRect(0,0,S*Q,S*Q);
  s2.globalCompositeOperation = "source-over";
  return { S, cv:sc.cv, sil:sc.sil };
}
function arenaReady(){ return !!(arenaImg && arenaImg.complete && arenaImg.naturalWidth>0); }


const _compImg = {};
function componentSprite(slot, id){ const t=COMPONENT_SPRITES[slot]; if(!t||!t[id]) return null;
  const k=slot+"/"+id; let im=_compImg[k];
  if(!im){ im=_compImg[k]=mkImg(t[id].src); }
  return im; }
function armorSprite(id){ const d=ARMOR_SPRITES[id]; if(!d) return null;
  const k="armor/"+id; let im=_compImg[k];
  if(!im){ im=_compImg[k]=mkImg(d.src); }
  return im; }
const PAINT_LO = 0.42, PAINT_HI = 0.72;   // L<LO → grime/rust kept, L>HI → paint (coloured)
const _spriteState = {};                   // chassis -> {def,img,layers,tint}
function spriteState(ch){ if(ch in _spriteState) return _spriteState[ch];
  const def=CHASSIS_SPRITES[ch];
  if(!def){ return _spriteState[ch]=null; }
  return _spriteState[ch]={ def, img:mkImg(def.src), layers:null, tint:{} }; }
function chassisSpriteReady(ch){ const st=spriteState(ch); return !!(st && st.img && st.img.complete && st.img.naturalWidth>0 && typeof document!=="undefined"); }
// decompose a plate into white PAINT mask + fixed DIRT overlay (grime/rust/scratches, never tinted)
function chassisLayers(ch){ const st=spriteState(ch); if(st.layers) return st.layers;
  const img=st.img, w=img.naturalWidth, h=img.naturalHeight;
  const bc=document.createElement("canvas"); bc.width=w; bc.height=h; const bx=bc.getContext("2d");
  bx.drawImage(img,0,0); const src=bx.getImageData(0,0,w,h).data;
  const paint=document.createElement("canvas"); paint.width=w; paint.height=h; const px=paint.getContext("2d"); const pm=px.createImageData(w,h);
  const dirt=document.createElement("canvas"); dirt.width=w; dirt.height=h; const dx=dirt.getContext("2d"); const di=dx.createImageData(w,h);
  const smooth=(a,b,x)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
  for(let i=0;i<src.length;i+=4){ const r=src[i],g=src[i+1],b=src[i+2],a=src[i+3];
    const L=(0.299*r+0.587*g+0.114*b)/255, p=smooth(PAINT_LO,PAINT_HI,L);
    pm.data[i]=pm.data[i+1]=pm.data[i+2]=255; pm.data[i+3]=Math.round(a*p);
    di.data[i]=r; di.data[i+1]=g; di.data[i+2]=b; di.data[i+3]=Math.round(a*(1-p)); }
  px.putImageData(pm,0,0); dx.putImageData(di,0,0);
  return st.layers={paint,dirt}; }
/* Sous file://, dessiner une image locale CONTAMINE le canvas : toute lecture de
   pixels (getImageData) jette SecurityError. Les data-URLs d'avant ne taintaient
   jamais — d'où la régression à l'externalisation des assets. La composition,
   elle, reste permise : on dégrade vers une teinte multiply pleine, sans
   séparation peinture/métal. Servi en http(s), le chemin riche reprend. */
function chassisLayersSafe(ch){
  const st=spriteState(ch);
  if(st.layers!==null && st.layers!==undefined) return st.layers;
  if(st.taintFallback) return null;
  try { return chassisLayers(ch); }
  catch(e){ st.taintFallback=true;
    if(!window.__taintWarned){ window.__taintWarned=true;
      console.warn("Sprites en mode dégradé (page ouverte en file:// — servez via http pour la teinte riche)."); }
    return null; } }
function tintedChassis(ch, color){ const st=spriteState(ch); if(st.tint[color]) return st.tint[color];
  const L=chassisLayersSafe(ch), img=st.img, w=img.naturalWidth, h=img.naturalHeight;
  const oc=document.createElement("canvas"); oc.width=w; oc.height=h; const o=oc.getContext("2d");
  if(L){                                       // chemin riche : peinture teintée + métal
    o.fillStyle=color; o.fillRect(0,0,w,h);
    o.globalCompositeOperation="destination-in"; o.drawImage(L.paint,0,0);
    o.globalCompositeOperation="source-over"; o.drawImage(L.dirt,0,0);
  } else {                                     // repli file:// : sprite × couleur (multiply)
    o.drawImage(img,0,0);
    o.globalCompositeOperation="multiply"; o.fillStyle=color; o.fillRect(0,0,w,h);
    o.globalCompositeOperation="destination-in"; o.drawImage(img,0,0);
    o.globalCompositeOperation="source-over";
  }
  return st.tint[color]=oc; }
function chassisFootBox(chassis){ const v=viewParams(chassis), b=chassisBounds(chassis);
  return { x:(b.minC-v.ccol)*v.cell, y:(b.minR-v.crow)*v.cell, w:(b.maxC-b.minC+1)*v.cell, h:(b.maxR-b.minR+1)*v.cell }; }
function drawChassisSprite(c, chassis, color){ const st=spriteState(chassis);
  const fb=chassisFootBox(chassis), B=st.def.body, s=fb.w/B.w;                 // uniform scale: body → footprint width
  const img=tintedChassis(chassis,color);
  const dx=(fb.x+fb.w/2)-(B.x+B.w/2)*s, dy=(fb.y+fb.h/2)-(B.y+B.h/2)*s;         // centre body on footprint
  c.drawImage(img, dx, dy, img.width*s, img.height*s); }
function buildColliders(build, layout){
  const chassis=build.chassis||"boxy", eq=build.parts||{};
  const v=viewParams(chassis), vis=colliderVis(chassis), list=[];
  const cr=0.6*v.cell; // small per-cell circle: mild overlap, tight union
  const cell=(cc,r,slot)=> list.push({slot, x:-vis*(r+0.5-v.crow)*v.cell, y:vis*(cc+0.5-v.ccol)*v.cell, r:vis*cr});
  const paveFoot=(col,row,f,slot)=>{ for(let dc=0;dc<f.w;dc++) for(let dr=0;dr<f.d;dr++) cell(col+dc,row+dr,slot); };
  // hull: pave the chassis cells (tapers naturally on wedge/dart — fewer cells up front),
  // but CHAMFER the 4 outer corners — one collider dropped per corner so the hull hugs
  // the plate's cut corners rather than a hard square.
  { const cb=chassisBounds(chassis);
    const doChamfer = !(CHASSIS_SPEC[chassis]&&CHASSIS_SPEC[chassis].mask); // mask hulls are already exact
    const rowCols=(r)=>{ let lo=99,hi=-1; for(let cc=0;cc<gridW(chassis);cc++) if(cellInChassis(chassis,cc,r)){ if(cc<lo)lo=cc; if(cc>hi)hi=cc; } return [lo,hi]; };
    const [tLo,tHi]=rowCols(cb.minR), [bLo,bHi]=rowCols(cb.maxR);
    const isCorner=(cc,r)=> doChamfer && ((r===cb.minR && (cc===tLo||cc===tHi)) || (r===cb.maxR && (cc===bLo||cc===bHi)));
    for(let r=0;r<gridH(chassis);r++) for(let cc=0;cc<gridW(chassis);cc++)
      if(cellInChassis(chassis,cc,r) && !isCorner(cc,r)) cell(cc,r,"chassis"); }
  // armor blade/fork: one row of reach in FRONT of the hull (the leverage weapon is physical)
  { const aid=eq.armor||"a0", aidx=ENGINE.PARTS.armor.findIndex(p=>p.id===aid);
    if(aidx>0){ for(let cc=0;cc<gridW(chassis);cc++){ // one cell ahead of each column's front-most hull cell
      for(let r=0;r<gridH(chassis);r++){ if(cellInChassis(chassis,cc,r)){ cell(cc, r-1, "armor"); break; } } } } }
  // propulsion: pave both mirrored side footprints — avec le MÊME débord
  // extérieur de 0.32 cellule que le dessin (P-OMBRES, WYSIWYG).
  { const id=eq.propulsion||ENGINE.PARTS.propulsion[0].id, f=footprintOf("propulsion",id);
    const p=layout.propulsion||{col:0,row:0};
    const OUT=0.32;
    for(let dc=0;dc<f.w;dc++) for(let dr=0;dr<f.d;dr++){
      cell(p.col+dc-OUT, p.row+dr, "propulsion");
      cell(mirrorCol(chassis,p.col,f.w)+dc+OUT, p.row+dr, "propulsion"); } }
  // externals (weapons/sensors) overhang the hull; internals are interior → not on the surface

  let bound=0; for(const c of list) bound=Math.max(bound, Math.hypot(c.x,c.y)+c.r);
  return { list, bound };
}
const CELL_CM = 3;
const LAYER_ELEV_CM = { chassis:1, internal:4, armor:7, external:9 };
const CG_REF = 2.36; // stabilityRaw of stock RUSTY (auto-arranged) → normalises stock to 1.0
function slotHeight(slot){ return (FOOT_BASE[slot]||{h:2}).h; }
function computeCG(build, layout){
  const chassis=build.chassis||"boxy", eq=build.parts||{};
  const b=chassisBounds(chassis); const centerRow=(b.minR+b.maxR+1)/2;
  let M=0,sx=0,sy=0,sz=0; const add=(m,x,y,z)=>{ M+=m; sx+=m*x; sy+=m*y; sz+=m*z; };
  add(ENGINE.PHYS.chassis[chassis].kg, 0, 0, LAYER_ELEV_CM.chassis*0.5);      // hull, low & centred
  { const id=eq.propulsion||ENGINE.PARTS.propulsion[0].id, f=footprintOf("propulsion",id);
    const p=layout.propulsion||{col:0,row:0}, m=ENGINE.partMassKg("propulsion",id);
    add(m, 0, (p.row+f.d/2-centerRow)*CELL_CM, LAYER_ELEV_CM.chassis + slotHeight("propulsion")/2); } // 2 sides → x=0
  for(const slot of instanceSlots(build)){
    const bs=baseSlot(slot), id=idAt(build, slot);
    if((bs==="weapon1"||bs==="weapon2") && ENGINE.PARTS[bs].findIndex(x=>x.id===id)===0) continue;
    const f=footprintOf(slot,id), p=layout[slot]||{col:0,row:0}, m=ENGINE.partMassKg(bs,id);
    const li=layerOf(slot), elev = li===1?LAYER_ELEV_CM.internal:LAYER_ELEV_CM.external;
    // ballast is a dense slug mounted at the very bottom of the hull — that's its
    // whole job: sit low and pull the CG down. It doesn't ride at mid-height.
    const z = bs==="ballast"
      ? LAYER_ELEV_CM.chassis * 0.5   // bolted to the baseplate — the very bottom
      : elev + (li===1?(p.floor||0)*FLOOR_H:0) + slotHeight(bs)/2;
    add(m, (p.col+f.w/2-gridCX(build.chassis))*CELL_CM, (p.row+f.d/2-centerRow)*CELL_CM, z);
  }
  { const id=eq.armor||"a0", m=ENGINE.partMassKg("armor",id); if(m>0) add(m,0,0,LAYER_ELEV_CM.armor); }
  const cgX=sx/M, cgY=sy/M, cgZ=sz/M;
  const pid=eq.propulsion||ENGINE.PARTS.propulsion[0].id, pf=footprintOf("propulsion",pid);
  const pp=layout.propulsion||{col:0,row:0};
  const trackHalf=(gridCX(build.chassis)-(pp.col+pf.w/2))*CELL_CM;       // lateral half-separation of the wheels
  const wheelbaseHalf=(pf.d*CELL_CM)/2;               // longitudinal contact half-length (tracks are long)
  const supportHalf=(trackHalf+wheelbaseHalf)/2;
  const stabilityRaw = supportHalf / Math.max(1,cgZ);
  // compress around 1.0: CG is a real lever, but loading a bot shouldn't tank it
  // so hard that the shop investment is negated. Spread 0.5 → range ~0.8–1.15.
  const CG_SPREAD = 0.5;
  const stability = 1 + (stabilityRaw/CG_REF - 1) * CG_SPREAD;
  return { cgX, cgY, cgZ, trackHalf, supportHalf, stabilityRaw, mass:M, stability };
}

// ---- rendering (zoom to the active chassis) ----
const BOARD_HALF = 100;
function viewParams(chassis){ const b=chassisBounds(chassis); const M=2; // cells of margin for overhang
  const cols=(b.maxC-b.minC+1)+2*M, rows=(b.maxR-b.minR+1)+2*M;
  const cell=(2*BOARD_HALF)/Math.max(cols,rows);
  return { cell, ccol:(b.minC+b.maxC+1)/2, crow:(b.minR+b.maxR+1)/2 }; }
function slotBox(chassis, slot, id, pos){ const v=viewParams(chassis); const f=footprintOf(slot,id);
  return { cx:(pos.col+f.w/2 - v.ccol)*v.cell, cy:(pos.row+f.d/2 - v.crow)*v.cell,
           wpx:f.w*v.cell-CELL_GAP, hpx:f.d*v.cell-CELL_GAP }; }
function chassisOutlinePath(c, chassis){ const v=viewParams(chassis);
  const pts=[]; const cx0=gridCX(chassis); for(let r=0;r<gridH(chassis);r++){ const h=chassisHalf(chassis,r); if(h<0) continue;
    const lo=cx0-h, hi=cx0+h, y0=(r-v.crow)*v.cell, y1=(r+1-v.crow)*v.cell;
    pts.push([ (lo-v.ccol)*v.cell, y0, (hi-v.ccol)*v.cell, y1 ]); }
  c.beginPath();
  for(let i=0;i<pts.length;i++){ const [lx,y0,rx,y1]=pts[i]; if(i===0)c.moveTo(lx,y0); c.lineTo(rx,y0); c.lineTo(rx,y1); }
  for(let i=pts.length-1;i>=0;i--){ const [lx,y0,rx,y1]=pts[i]; c.lineTo(lx,y1); c.lineTo(lx,y0); }
  c.closePath(); }
function drawChassisBoard(c, chassis, color){
  if(color && chassisSpriteReady(chassis)){ drawChassisSprite(c, chassis, color); return; } // sprite for any chassis
  c.save(); c.fillStyle=color||DEFAULT_CHASSIS_COLOR; c.strokeStyle="#3f4654"; c.lineWidth=2;
  chassisOutlinePath(c, chassis); c.fill(); c.stroke(); c.restore(); }
function drawArmorShell(c, chassis, id){ const idx=ENGINE.PARTS.armor.findIndex(p=>p.id===id);
  if(idx<=0) return; // a0 / none → internals exposed
  drawArmorFront(c, chassis, id, idx); }
function drawArmorFront(c, chassis, id, idx){
  // front attachment (bumper a1 / blade a2 / fork a3): full-width bar at the hull front,
  // rotated 180° to face forward, sitting just ahead of the leading edge (minimal overlap).
  const v=viewParams(chassis), b=chassisBounds(chassis);
  const fullW=(b.maxC-b.minC+1)*v.cell*1.02;
  const cxF=((b.minC+b.maxC+1)/2 - v.ccol)*v.cell, yF=(b.minR - v.crow)*v.cell;
  const spr=armorSprite(id);
  if(spr && spr.complete && spr.naturalWidth>0){
    const w=fullW, h=w*spr.naturalHeight/spr.naturalWidth;
    c.save(); c.translate(cxF, yF - h*0.38); c.rotate(Math.PI);   // 180° + only ~12% overlap
    c.drawImage(spr, -w/2, -h/2, w, h); c.restore(); return;
  }
  const half=fullW/2, col=tierColor("armor", id);
  c.save(); c.fillStyle=col; c.strokeStyle="rgba(0,0,0,.4)"; c.lineWidth=1.5; c.translate(cxF,0);
  if(idx<=2){ rr(c, -half, yF - v.cell*0.7, half*2, v.cell*0.75, 2); c.fill(); c.stroke(); }
  else {     const pw=v.cell*0.5, plen=v.cell*1.4;
    for(const fx of [-half+pw*0.5, -pw/2, half-pw*1.5]){ c.beginPath();
      c.moveTo(fx, yF+1); c.lineTo(fx+pw, yF+1); c.lineTo(fx+pw*0.5, yF-plen); c.closePath(); c.fill(); c.stroke(); } }
  c.restore(); }
function drawPartTile(c, slot, id, cx, cy, wpx, hpx, spin=0, alpha=1, slip=0, mirror=false){
  const spr = componentSprite(slot, id);
  if(spr && spr.complete && spr.naturalWidth>0){
    c.save(); c.globalAlpha=alpha; c.translate(cx,cy); if(mirror) c.scale(-1,1);
    const s=Math.min(wpx/spr.naturalWidth, hpx/spr.naturalHeight)*1.06;    // fit to footprint box
    const dw=spr.naturalWidth*s, dh=spr.naturalHeight*s;
    c.drawImage(spr, -dw/2, -dh/2, dw, dh);
    if(slot==="propulsion"){                                  // procedural tread motion, driven by spin (no frames)
      const long=dh>=dw, L=long?dh:dw, Wd=long?dw:dh, gap=Math.max(6,L*0.16);
      const off=((spin*3)%gap+gap)%gap, band=Wd*0.6;
      c.save(); c.beginPath(); c.rect(-dw/2,-dh/2,dw,dh); c.clip();
      c.globalAlpha=alpha*0.22; c.fillStyle="#07080a";
      for(let p=-L/2-gap+off; p<L/2; p+=gap){
        if(long) c.fillRect(-band/2, p, band, gap*0.32); else c.fillRect(p, -band/2, gap*0.32, band); }
      c.restore(); c.globalAlpha=alpha;
    }
    if(slot==="propulsion" && slip>0.12){ c.globalCompositeOperation="source-atop";
      c.globalAlpha=alpha*Math.min(1,(slip-0.12)/0.5)*0.45; c.fillStyle="#e24b4a"; c.fillRect(-dw/2,-dh/2,dw,dh); }
    c.restore(); return;
  }
  if (slot==="software"){                                    // S10 : plaque de version comme visuel
    const vim = stickerImg("v"+String(id).replace(/^s/,""));
    if (vim && vim.complete && vim.naturalWidth>0){
      c.save(); c.globalAlpha=alpha;
      const s2=Math.min(wpx/vim.naturalWidth, hpx/vim.naturalHeight)*1.5;
      c.drawImage(vim, cx-vim.naturalWidth*s2/2, cy-vim.naturalHeight*s2/2, vim.naturalWidth*s2, vim.naturalHeight*s2);
      c.restore(); return;
    }
  }
  c.save(); c.globalAlpha=alpha;
  let fill=tierColor(slot,id);
  if(slot==="propulsion"&&slip>0.12){ const k=Math.min(1,(slip-0.12)/0.5); fill=mixHex(fill,"#e24b4a",k*0.7); }
  c.fillStyle=fill; c.strokeStyle="rgba(0,0,0,.35)"; c.lineWidth=1.5;
  rr(c, cx-wpx/2, cy-hpx/2, wpx, hpx, 5); c.fill(); c.stroke();
  const r=Math.min(wpx,hpx)/2;
  if(slot==="propulsion"){ c.strokeStyle=slip>0.3?"#ffe0e0":"rgba(255,255,255,.9)"; c.lineWidth=2; c.lineCap="round";
    for(let k=0;k<4;k++){ const a=spin+k*Math.PI/2;
      c.beginPath(); c.moveTo(cx,cy); c.lineTo(cx+Math.cos(a)*r*0.7, cy+Math.sin(a)*r*0.7); c.stroke(); } }
  else { c.fillStyle="rgba(255,255,255,.95)"; c.font=`700 ${Math.round(r*0.95)}px system-ui,sans-serif`;
    c.textAlign="center"; c.textBaseline="middle"; c.fillText(PART_GLYPH[slot]||"?", cx, cy+1); }
  c.restore();
}
function freeChassisCell(build, layout){ // a surface cell not under wheels/weapons/sensors
  const chassis=build.chassis, eq=build.parts||{}, covered=new Set();
  const cover=(col,row,f)=>{ for(let dc=0;dc<f.w;dc++)for(let dr=0;dr<f.d;dr++) covered.add((col+dc)+","+(row+dr)); };
  { const id=eq.propulsion||ENGINE.PARTS.propulsion[0].id, f=footprintOf("propulsion",id), p=layout.propulsion||{col:0,row:0};
    cover(p.col,p.row,f); cover(mirrorCol(chassis,p.col,f.w),p.row,f); }
  /* P-PLAN-UNIQUE : capteurs/armes sont dans instanceSlots — couverts par la
     boucle générale d'équipement de l'appelant. */
  const b=chassisBounds(chassis), midR=Math.round((b.minR+b.maxR)/2);
  let best=null,bestD=1e9;
  for(let r=b.minR;r<=b.maxR;r++)for(let cc=b.minC;cc<=b.maxC;cc++){
    if(!cellInChassis(chassis,cc,r) || covered.has(cc+","+r)) continue;
    const d=Math.abs(cc+0.5-gridCX(chassis))+Math.abs(r-midR)*0.6; if(d<bestD){bestD=d;best={col:cc,row:r};} }
  return best;
}
function drawBotTiles(c, build, layout, spin, opts={}){
  const chassis=build.chassis, eq=build.parts||{};
  if(opts.shadow){ // soft ground shadow: blurred hull silhouette, small offset
    c.save(); c.globalAlpha=0.30; c.translate(3,7); c.filter="blur(5px)";
    c.fillStyle="#000"; chassisOutlinePath(c, chassis); c.fill();
    c.filter="none"; c.restore(); }
  if(opts.bellyUp){ // on its back: dark underside, wheels sticking up — unmistakable
    drawChassisBoard(c, chassis, mixHex(build.color||DEFAULT_CHASSIS_COLOR, "#14161c", 0.55));
    const id=eq.propulsion||ENGINE.PARTS.propulsion[0].id, f=footprintOf("propulsion",id);
    const p=layout.propulsion||{col:0,row:0};
    for(const [ci,col] of [[0,p.col],[1,mirrorCol(chassis,p.col,f.w)]]){ const b=slotBox(chassis,"propulsion",id,{col,row:p.row});
      drawPartTile(c, "propulsion", id, b.cx, b.cy, b.wpx, b.hpx, spin*0.3, 1, 0, ci===1); }
    return;
  }
  drawChassisBoard(c, chassis, build.color);
  /* P-OMBRES : chaque composant monté porte sa micro-ombre sur la tôle —
     drop-shadow natif (silhouette exacte du sprite), blur 1.2, +2/+3, .30.
     Les roues DÉBORDENT du chant (WYSIWYG des colliders) : décalage
     latéral vers l'extérieur de 0.32 cellule par côté. */
  const MICRO_SHADOW = 'drop-shadow(2px 3px 1.2px rgba(0,0,0,0.30))';
  const shadowed = (fn)=>{ if(!("filter" in c)){ fn(); return; }
    const keep=c.filter; c.filter = (keep && keep!=="none" ? keep+" " : "") + MICRO_SHADOW;
    fn(); c.filter = keep || "none"; };
  const drawSlot=(slot)=>{
    const li=layerOf(slot), bs=baseSlot(slot);
    const id=idAt(build, slot);
    const NONE_SLOTS={weapon1:1,weapon2:1,ballast:1,srimech:1,sensors:1,software:1};
    if(NONE_SLOTS[bs] && ENGINE.PARTS[bs].findIndex(p=>p.id===id)===0) return; // "aucun" → rien
    const pos=layout[slot]||{col:0,row:0}; const floor=(li===1?(pos.floor||0):0);
    const b=slotBox(chassis,bs,id,pos);
    const lift=floor*4; // higher internal floors are drawn raised (up-left)
    let alpha=(opts.focus==null||opts.focus<0||opts.focus===li)?1:0.3;
    if(li===1 && opts.focusFloor!=null && floor!==opts.focusFloor) alpha*=0.35;
    if(bs==="propulsion"){
      const f=footprintOf(bs,id);
      const OUT=(viewParams(chassis).cell)*0.32;                 // débord extérieur
      const bl=slotBox(chassis,bs,id,pos);
      const br=slotBox(chassis,bs,id,{col:mirrorCol(chassis,pos.col,f.w),row:pos.row});
      shadowed(()=>{
        drawPartTile(c, bs, id, bl.cx-OUT, bl.cy, bl.wpx, bl.hpx, spin, alpha, opts.slip||0, false);
        drawPartTile(c, bs, id, br.cx+OUT, br.cy, br.wpx, br.hpx, spin, alpha, opts.slip||0, true);
      });
      return;
    }
    shadowed(()=> drawPartTile(c, bs, id, b.cx-lift, b.cy-lift, b.wpx, b.hpx, spin, alpha, 0));
    if(floor>0){ c.save(); c.globalAlpha=alpha; c.fillStyle="rgba(255,255,255,.9)"; c.font="bold 9px system-ui";
      c.textAlign="right"; c.textBaseline="top"; c.fillText(String(floor+1), b.cx-lift+b.wpx/2-2, b.cy-lift-b.hpx/2+1); c.restore(); }
  };
  drawSlot("propulsion");                                                   // chassis level
  const eqSlots = instanceSlots(build);                                    // plan unique
  eqSlots.filter(sl=>!PROTRUDE_OK[baseSlot(sl)]).forEach(drawSlot);        // contenu d'abord
  eqSlots.filter(sl=> PROTRUDE_OK[baseSlot(sl)]).forEach(drawSlot);        // débordants par-dessus
  const decals = build.stickers0 || [];                                    // decals : placement LIBRE (x,y continus)
  if(decals.length){ const v=viewParams(chassis);
    c.save();
    const dim = (opts.focus!=null && opts.focus>=0 && opts.focus!==STICKER_LAYER);
    c.globalAlpha = dim ? 0.3 : 1;
    for(const d of decals){ const st=stickerOf(d.id); if(!st) continue;
      const cx = (d.x ?? (d.col+0.5)) - v.ccol, cy = (d.y ?? (d.row+0.5)) - v.crow;   // rétro-lecture col/row
      const im = stickerImg(d.id);
      if(im && im.complete && im.naturalWidth>0){
        const hgt = v.cell*1.6, wdt = Math.min(hgt*st.w/st.h, v.cell*4.2), h2 = wdt*st.h/st.w;
        c.drawImage(im, cx*v.cell - wdt/2, cy*v.cell - h2/2, wdt, h2);
      } else { c.fillStyle="rgba(255,255,255,.25)"; c.fillRect(cx*v.cell-6, cy*v.cell-6, 12, 12); } }
    c.restore(); }
}
const EDITOR_BG = { S:"assets/bg_s_nerd.webp", M:"assets/bg_s_mat.webp" };   // E5 : par classe
const _edBg = {};
function editorBgImg(cls){ const src=EDITOR_BG[cls]||EDITOR_BG.M;
  if(!_edBg[src]){ const im=new Image(); im.src=src; _edBg[src]=im; }
  return _edBg[src]; }
function drawEditor(canvas, build, layout, spin, focusLayer=-1, cgOn=false, hbOn=false){
  const c=canvas.getContext("2d"); const w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h);
  { const bg=editorBgImg(chassisClassOf(build.chassis));                       // E5 : fond d'atelier
    if(bg.complete && bg.naturalWidth>0){
      const s0=Math.max(w/bg.width,h/bg.height);
      c.globalAlpha=0.9;
      c.drawImage(bg,(w-bg.width*s0)/2,(h-bg.height*s0)/2,bg.width*s0,bg.height*s0);
      c.globalAlpha=1;
    } }
  c.save(); c.translate(w/2,h/2);
  const sc=(Math.min(w,h)*0.47)/BOARD_HALF; c.scale(sc,sc);
  if(focusLayer>=0){ const v=viewParams(build.chassis); c.strokeStyle="rgba(120,130,150,.16)"; c.lineWidth=1;
    const GW=gridW(build.chassis), GH=gridH(build.chassis);
    for(let gc=0;gc<=GW;gc++){ const x=(gc-v.ccol)*v.cell;
      c.beginPath(); c.moveTo(x,(0-v.crow)*v.cell); c.lineTo(x,(GH-v.crow)*v.cell); c.stroke(); }
    for(let gr=0;gr<=GH;gr++){ const y=(gr-v.crow)*v.cell;
      c.beginPath(); c.moveTo((0-v.ccol)*v.cell,y); c.lineTo((GW-v.ccol)*v.cell,y); c.stroke(); } }
  drawBotTiles(c, build, layout, spin, {focus:focusLayer, shadow:focusLayer<0});
  if(hbOn){ const col=buildColliders(build, layout), vis=colliderVis(build.chassis);
    c.save(); c.lineWidth=2.5;
    for(const k of col.list){ const bx=k.y/vis, by=-k.x/vis, rb=k.r/vis;
      c.strokeStyle = k.slot==="chassis" ? "rgba(90,205,255,.85)"
        : (k.slot==="propulsion" ? "rgba(255,170,50,.95)" : "rgba(255,80,80,.95)");
      c.beginPath(); c.arc(bx,by,rb,0,7); c.stroke(); }
    c.restore();
  }
  if(cgOn){
    const cg=computeCG(build, layout); const v=viewParams(build.chassis);
    const px=cg.cgX/CELL_CM*v.cell, py=cg.cgY/CELL_CM*v.cell;
    const tt=Math.max(0,Math.min(1,(cg.cgZ-1.6)/3)); // low CG = stable (green), high = tippy (red)
    const col=mixHex("#3ad17a","#e24b4a",tt);
    c.save(); c.strokeStyle=col; c.fillStyle=col; c.lineWidth=2.5;
    c.beginPath(); c.arc(px,py,8,0,7); c.stroke();
    c.beginPath(); c.moveTo(px-13,py); c.lineTo(px+13,py); c.moveTo(px,py-13); c.lineTo(px,py+13); c.stroke();
    c.beginPath(); c.arc(px,py,2.5,0,7); c.fill();
    c.fillStyle="#e8eaee"; c.font="bold 11px system-ui"; c.textAlign="center"; c.textBaseline="bottom";
    c.fillText("CG "+cg.cgZ.toFixed(1)+"cm", px, py-11);
    c.restore();
  }
  /* UX tactile : la pièce ou le sticker en cours de drag est surligné —
     anneau ambre pulsant, lisible sous le doigt même pour une 1×1. */
  if (typeof editDrag !== "undefined" && editDrag && canvas.id === "editorCv"){
    const v = viewParams(build.chassis);
    const pulse = 0.55 + 0.45*Math.sin((spin||0)*4);
    c.lineWidth = 2.5; c.strokeStyle = `rgba(255,155,61,${(0.5+0.5*pulse).toFixed(2)})`;
    c.shadowColor = "rgba(255,155,61,.8)"; c.shadowBlur = 10*pulse;
    if (editDrag.slot != null && layout[editDrag.slot]){
      const p = layout[editDrag.slot], f = footprintOf(editDrag.slot, curId(editDrag.slot));
      c.strokeRect((p.col-v.ccol)*v.cell-3, (p.row-v.crow)*v.cell-3, f.w*v.cell+6, f.d*v.cell+6);
    } else if (editDrag.sticker != null && S.customize.placed[editDrag.sticker]){
      const d = S.customize.placed[editDrag.sticker];
      const cx = (d.x ?? d.col+0.5) - v.ccol, cy = (d.y ?? d.row+0.5) - v.crow;
      c.beginPath(); c.arc(cx*v.cell, cy*v.cell, v.cell*0.95, 0, Math.PI*2); c.stroke();
    }
    c.shadowBlur = 0;
  }
  c.restore();
}

// ---- interaction (grid-snap; per-level constraints) ----
let editFocus=-1, editSpin=0, editDrag=null, showCG=false, showHB=false;
function editorBoardPoint(canvas, ev){ const rect=canvas.getBoundingClientRect();
  const sc=(Math.min(canvas.width,canvas.height)*0.47)/BOARD_HALF;
  const sx=canvas.width/rect.width, sy=canvas.height/rect.height;
  return { x:((ev.clientX-rect.left)*sx-canvas.width/2)/sc, y:((ev.clientY-rect.top)*sy-canvas.height/2)/sc }; }
function pxToCell(chassis,x,y){ const v=viewParams(chassis);
  return { col:Math.floor(x/v.cell+v.ccol), row:Math.floor(y/v.cell+v.crow) }; }
function editorHit(layout, cell){
  if(editFocus<0 || editFocus===STICKER_LAYER){
    for(let i=S.customize.placed.length-1; i>=0; i--){ const d=S.customize.placed[i];
      const cx = d.x ?? (d.col+0.5), cy = d.y ?? (d.row+0.5);
      if(Math.abs(cx-(cell.col+0.5))<=1.0 && Math.abs(cy-(cell.row+0.5))<=0.8) return {sticker:i}; } }
  if(editFocus===STICKER_LAYER) return null;
  for(let li=EDIT_LAYERS.length-1; li>=0; li--){ if(editFocus>=0&&editFocus!==li) continue;
    for(const slot of EDIT_LAYERS[li].slots){ const p=layout[slot]; if(!p) continue;
      if(!isMounted(slot, curId(slot))) continue;
      const f=footprintOf(slot, curId(slot));
      const M=0.38;                                 // marge tactile : une 1×1 se saisit au doigt
      const inRect=(col)=>cell.col>=col-M&&cell.col<col+f.w+M&&cell.row>=p.row-M&&cell.row<p.row+f.d+M;
      if(inRect(p.col)) return slot;
      if(li===0 && inRect(mirrorCol(build.chassis,p.col,f.w))) return slot; // right wheel selects the pair
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
      drawEditor($("editorCv"), {chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}, color:S.customize.color, stickers0:S.customize.placed}, getLayout(), editSpin, editFocus, showCG, showHB);
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
  for (const slot of SLOT_ORDER){
    if (RETIRED_SLOTS[slot]) continue;                       // P-PLAN-UNIQUE
    const row = document.createElement("div"); row.className = "slotrow";
    const nm = document.createElement("div"); nm.className = "sname";
    nm.textContent = t("slot_"+slot);
    row.appendChild(nm);
    const cur = document.createElement("div"); cur.className = "scur";
    if (slot === "chassis"){
      cur.innerHTML = `${chassisName(AB().chassis)}<span class="pfx">${t("weldedChassis")}</span>`;
      row.appendChild(cur);
    } else if (slot === "weapon1" || slot === "weapon2"){
      cur.innerHTML = `${t("pn_"+(slot==="weapon1"?"w0":"x0"))}<span class="pfx">${t("noneAvail")}</span>`;
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
      const owned = S.parts.owned[slot];
      if (owned.length > 1){
        const tiles = document.createElement("div"); tiles.className = "rc-tiles rc-tiles--fit";
        const ordered = owned.slice().sort((a,b)=>            // ascending capacity (PARTS order)
          ENGINE.PARTS[slot].findIndex(p=>p.id===a) - ENGINE.PARTS[slot].findIndex(p=>p.id===b));
        for (const id of ordered){
          const tl = document.createElement("div");
          tl.className = "rc-tile" + (id===eqId ? " is-active" : "");
          const gl = document.createElement("div"); gl.className = "rc-tile__glyph";
          gl.appendChild(tileCanvas(40, (c2)=>drawPartTile(c2, slot, id, 20, 20, 36, 31, 0, 1)));
          tl.appendChild(gl);
          const nOwn = invCount(id);
          const nmT = document.createElement("div"); nmT.className = "rc-tile__name";
          nmT.textContent = t("pn_"+id) + (nOwn>1 ? " \u00D7"+nOwn : "");
          tl.appendChild(nmT);
          tl.onclick = ()=>{
            if (id === S.parts.equipped[slot]) return;
            if (!tryEquip(slot, id)){ showToast(t("noRoom")); return; }
            saveState(); renderHome(); };
          tiles.appendChild(tl);
        }
        const shopT = document.createElement("div"); shopT.className = "rc-tile rc-tile--shop";
        shopT.innerHTML = `<div class="rc-tile__glyph" style="background:none;color:var(--rc-amber);font:400 18px var(--rc-f-display);clip-path:none">+</div>
          <div class="rc-tile__name" style="color:var(--rc-amber)">${t("tabShop")}</div>`;
        shopT.onclick = ()=>goTab("shop");
        tiles.appendChild(shopT);
        row.appendChild(tiles);
      }
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
  } else if (!OPTIONAL_SLOTS[slot]) return false;
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
  if (ok){ syncActive(); recomputeOwned(); }
  return ok;
}
function mkPartCard(type, part, reserved){
  const card = document.createElement("div"); card.className = "rc-gcard";
  const art = document.createElement("div"); art.className = "rc-gcard__art";
  const cv = tileCanvas(54, (c)=>drawPartTile(c, type, part.id, 27, 27, 50, 44, 0, 1));
  art.appendChild(cv); card.appendChild(art);
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
    btn.onclick = ()=>{ if(tryEquip(type, part.id)){ saveState(); renderHome(); } else showToast(t("noRoom")); }; }
  else { btn.innerHTML = BOLT_SVG + " " + part.cost; btn.disabled = S.bolts < part.cost;
    btn.onclick = ()=>{ if (S.bolts < part.cost) return; S.bolts -= part.cost;
      mintInstance(part.id); recomputeOwned();
      const fits = tryEquip(type, part.id); saveState();
      showToast(fits ? t("bought", {name:t("pn_"+part.id)}) : t("noRoom")); renderHome(); }; }
  card.appendChild(btn);
  return card;
}
// ---- L1: garage strip (active-bot selector + buyable chassis) ----

function chassisName(ch){ return (CHASSIS_INFO[ch]&&CHASSIS_INFO[ch].name)||ch.toUpperCase(); }
function setActiveBot(i){ if(i<0||i>=S.garage.length||i===S.activeBot) return;
  S.activeBot=i; syncActive(); recomputeOwned(); saveState(); renderHome(); }
function buyBot(chassis){ const info=CHASSIS_INFO[chassis]; if(!info) return;
  if(S.bolts < info.cost){ showToast(t("noBolts")); return; }
  S.bolts -= info.cost;
  const bot = newBotInto(S.inv, chassis); refit(bot);   // châssis neuf = kit de base minté
  S.garage.push(bot); S.activeBot = S.garage.length-1;
  syncActive(); recomputeOwned(); saveState();
  showToast(t("botBought",{name:info.name})); showTab("workshop"); renderHome(); }
function drawBotThumb(ctx, chassis, color, L){ L=L||64; ctx.clearRect(0,0,L,L);
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
  const me = m.bots[0], bot = AB();
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
  const dch = totJ*K.CHASSIS_J_K + me.contactT*K.CHASSIS_GRIND_K;   // châssis
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
  const name = chassisName(S.garage[i].chassis);
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
    const cv = tileCanvas(64, (c)=>drawBotThumb(c, bot.chassis, bot.customize.color));
    th.appendChild(cv); card.appendChild(th);
    const nm=document.createElement("div"); nm.className="rc-botcell__name"; nm.textContent=chassisName(bot.chassis); card.appendChild(nm);
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
function renderChassisShop(){ const el=$("chassisShop"); if(!el) return; el.innerHTML="";
  /* E5 — sections PAR CLASSE (S, M, futures), cartes larges, rendu net */
  const byClass = {};
  for(const ch of BUYABLE_CHASSIS) (byClass[chassisClassOf(ch)] ||= []).push(ch);
  for(const cls of ["S","M","L","XXL"]){
    if(!byClass[cls]) continue;
    const head=document.createElement("div"); head.className="rc-section";
    head.textContent=t("shopChassis")+" \u00B7 "+t("classe")+" "+cls; el.appendChild(head);
    const strip=document.createElement("div"); strip.className="rc-botstrip rc-botstrip--big";
    for(const ch of byClass[cls]){ const info=CHASSIS_INFO[ch];
      const card=document.createElement("div"); card.className="rc-botcell rc-botcell--big"+(S.bolts<info.cost?" cant":"");
      const th=document.createElement("div"); th.className="rc-botcell__thumb rc-botcell__thumb--big";
      const cv = tileCanvas(128, (c)=>drawBotThumb(c, ch, null, 128));
      th.appendChild(cv); card.appendChild(th);
      const nm=document.createElement("div"); nm.className="rc-botcell__name"; nm.textContent=info.name; card.appendChild(nm);
      const pr=document.createElement("div"); pr.className="botprice"; pr.innerHTML=BOLT_SVG+" "+info.cost; card.appendChild(pr);
      card.onclick=()=>buyBot(ch); strip.appendChild(card); }
    el.appendChild(strip); }
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
function swTier(id){ return ENGINE.PARTS.software.findIndex(p=>p.id===id); }
// validate a build against a tournament's rules → {ok, fails:[msg]}
function checkEntry(build, rules){
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
    fails.push(t("scrSoftware",{v:swTier(r.maxSoftware)+1}));
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
  for (const lg of LIGUES) if (lg.concours.includes(concoursId)) return lg.purseMult || 1;
  return 1;
}
function snapshotBuild(){                                          // gel du build à l'engagement
  const b = { chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts} };
  return { ...b, color:S.customize.color, stickers:[...S.customize.placed], layout:autoArrange(b) };
}
/* engageConcours — l'engagement est un acte explicite et nommé (jamais un effet
   de bord d'un clic). Vérifie déverrouillage + homologation, initialise l'état
   du format, gèle le build si le concours le déclare (lockBuild). */
function engageConcours(id){
  curVsConcours = id;                                            // E4
  const tr = tournamentById(id);
  if (!tr) return { ok:false, fails:["?"] };
  if (CN(id)) return { ok:false, fails:[], already:true };
  if (!unlockMet(tr.unlock)){
    const msg = (tr.unlock && tr.unlock.beaten != null)
      ? t("lockBeaten", {n: tr.unlock.beaten}) + " (" + S.beaten + "/" + tr.unlock.beaten + ")"
      : t("soon");
    return { ok:false, fails:[msg], locked:true };
  }
  const myBuild = { chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts} };
  const chk = checkEntry(myBuild, tr.rules);
  if (!chk.ok) return chk;
  const st = FORMATS[tr.format].init(Math.floor(Math.random()*1e9), tr.rounds);
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
      if(realWin){
        if(S.tourney.idx < 2){ S.tourney.idx++; return {kind:"next", i:S.tourney.idx+1}; }
        const prize = Math.round(w*5*purseMult("sumoM")); S.bolts += prize;   // E1 : bourse ×ligue
        if(!S.badges.includes(S.level)) S.badges.push(S.level);
        let champion=false;
        if(S.level >= 5){ S.champion=true; champion=true; } else { S.level++; }
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
    RIVALS: ["MAXIMUS","VORTEX","BRUTUS","NOVA","TITAN","RAZOR","CINDER","JOLT"],
    _rng(seed){ let a=(seed>>>0)||1; return ()=>{ a=(a*1664525+1013904223)>>>0; return a/4294967296; }; },
    init(seed, rounds){ const rng=this._rng(seed);
      const rivals=this.RIVALS.slice(0,5).map(n=>({name:n, strength:0.35+rng()*0.5, score:0}));
      return { format:"championnat", round:0, rounds:rounds||10, myScore:0, rivals }; },
    // record your match: score = duels you won this bout (0..2 in best-of-3). Returns true when the season ends.
    recordMatch(lg, myDuels){ lg.myScore += Math.max(0, Math.min(2, myDuels|0));
      const rng=this._rng((lg.round+1)*7919);
      for(const r of lg.rivals){ r.score += (rng()<r.strength ? 2 : (rng()<0.5?1:0)); }
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
    init(seed){ const rng=this._rng(seed);
      const ents=[{name:"VOUS", me:true, strength:0.5}];
      const names=this.NAMES.slice(); // shuffle rivals into the field
      for(let i=names.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [names[i],names[j]]=[names[j],names[i]]; }
      for(let i=0;i<15;i++) ents.push({ name:names[i], strength:0.3+rng()*0.55 });
      return { format:"bracket", seed, round:0, rounds:4, out:false, current: ents, path:[ents.slice()] }; },
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
    roundName(bk){ return ["16es","Quarts","Demi","Finale"][Math.min(3,bk.round)]; },
    prize(bk, w){ const r=bk.round, champ=!bk.out && r>=bk.rounds;
      const total=[w, w*2, w*3, w*5, w*8][Math.min(4,r)];
      return { round:r, champ, total }; }
  }
};
function rulesSummary(r){ const p=[];
  if(r.chassisClass) p.push("Classe "+r.chassisClass);
  if(r.banWeapons) p.push(t("scrWeapons"));
  if(r.banTracks) p.push(t("scrTracks"));
  if(r.maxSoftware) p.push(t("scrSoftware",{v:swTier(r.maxSoftware)+1}));
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
function renderBracketView(id){ const el=$("bracketView"); if(!el) return;   // E4 : générique par id
  id = id || "cupM";
  if(!S.concours[id]){ el.style.display="none"; el.innerHTML=""; return; }
  const bk=S.concours[id]; el.style.display="block"; el.innerHTML="";
  const head=document.createElement("div"); head.className="persohead";
  head.textContent=t("bracketTitle")+" \u00B7 "+(FORMATS.bracket.isDone(bk)?t("bracketDone"):FORMATS.bracket.roundName(bk)); el.appendChild(head);
  const wrap=document.createElement("div"); wrap.className="bkcols";
  const labels=["16es","Quarts","Demi","Finale","\uD83C\uDFC6"];
  const totalCols = FORMATS.bracket.isDone(bk) ? bk.path.length : 5;
  for(let ci=0; ci<totalCols; ci++){
    const col=document.createElement("div"); col.className="bkcol";
    const cl=document.createElement("div"); cl.className="bklabel"; cl.textContent=labels[ci]||""; col.appendChild(cl);
    const rnd = bk.path[ci];
    if(rnd){ rnd.forEach(e=>{ const cell=document.createElement("div"); cell.className="bkcell"+(e.me?" me":""); cell.textContent=e.me?t("you"):e.name; col.appendChild(cell); }); }
    else { const n=Math.max(1, 16>>ci); for(let k=0;k<n;k++){ const cell=document.createElement("div"); cell.className="bkcell future"; cell.textContent="?"; col.appendChild(cell); } }
    wrap.appendChild(col); }
  el.appendChild(wrap); }
function renderChampStandings(id){ const el=$("champStandings"); if(!el) return; // E4 : générique par id
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
    const open = unlockMet(lg.unlock);
    const a = document.createElement("div");
    a.className = "rc-league" + (open ? " is-open" : " is-locked");
    const nEng = lg.concours.filter(id => CN(id)).length;
    const meta = open
      ? t("nConcours", {n:lg.concours.length}) + (nEng ? " · " + t("kEnCours", {k:nEng}) : "")
      : t("soon");
    a.innerHTML = `<div class="rc-league__crest"${open?' style="color:var(--rc-violet-lt)"':''}>${open?"◈":"🔒"}</div>
      <div class="rc-league__body"><div class="rc-league__name">${da(lg.name)}</div>
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
  $("vsCrumbLigue").textContent = da(lg ? lg.name : t("tabFight"));
  $("vsCrumbLigue").className = "crumb-link";
  $("vsCrumbLigue").onclick = ()=>NAV.uiBack();
  $("vsCrumbConcours").textContent = da(tr.name);
  $("vsCrumbConcours").className = "crumb-link";
  $("vsCrumbConcours").onclick = ()=>NAV.uiBack();
  $("vsCrumbManche").textContent = vsMancheLabel(tr);
  $("vsFormat").textContent = formatLabel(tr).toUpperCase();
  $("vsManche").textContent = vsMancheLabel(tr);
  // mon bot — celui qui combattra VRAIMENT : le build gelé si le concours gèle
  const lock = (CN(tr.id)||{}).lock || null;
  const myBuild = {...S.settings,
    chassis: lock ? lock.chassis : AB().chassis,
    parts: {...(lock ? lock.parts : S.parts.equipped)},
    counts: {...(lock ? (lock.counts||{}) : AB().counts)},
    color: lock ? lock.color : S.customize.color,
    stickers0: lock ? lock.stickers : S.customize.placed};
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
  // comportement, ici et seulement ici (une source : S.settings)
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
  $("styleLine").textContent = t("styleLabel")+" "+t(ENGINE.tendencyKey(S.settings));
  const pr = $("powerRow"); pr.innerHTML = ""; const pf = makeSeg("power"); if (pf) pr.appendChild(pf);
}
function renderLigueScreen(){
  const lg = ligueById(curLigue); if(!lg) return;
  $("crumbRoot").textContent = t("tabFight");
  $("crumbRoot").className = "crumb-link";
  $("crumbRoot").onclick = ()=>NAV.uiBack();
  $("ligueName").textContent = da(lg.name);
  const el = $("concoursList");
  // re-parquer les vues de detail AVANT de vider la liste (sinon innerHTML les detruit)
  for (const did of ["tourneyBanner","champStandings","bracketView"]){
    const n = $(did); if (n && n.parentElement !== $("ligueScreen")) $("ligueScreen").appendChild(n); }
  el.innerHTML = "";
  const myBuild = { chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts} };
  for (const id of lg.concours){
    const tr = tournamentById(id); if(!tr) continue;
    const st = CN(id), open = unlockMet(tr.unlock), chk = checkEntry(myBuild, tr.rules);
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
        <div class="rc-cup__name">${da(tr.name)}</div>
        <div class="rc-cup__struct">${formatLabel(tr)}</div></div>
        <div class="rc-cup__progress"${prog?'':' style="color:var(--rc-muted)"'}>${prog||t("newTag")}</div></div>
      <div class="rc-cup__constraints"><span class="rc-chip">${rulesSummary(tr.rules)}</span>`;
    if (!chk.ok && open && !st)                       // éligibilité DÉTAILLÉE si refus
      inner += chk.fails.map(f=>`<span class="rc-chip rc-chip--red">✗ ${f}</span>`).join("");
    else if (open && !st && !tr.noEngage)
      inner += `<span class="rc-chip rc-chip--violet">✓ ${t("scrPass")}</span>`;
    inner += `</div><div class="rc-cup__foot"></div>`;
    card.innerHTML = inner;
    const foot = card.querySelector(".rc-cup__foot");
    const btn = (label, cls, fn) => { const b=document.createElement("button");
      b.className="rc-btn "+(cls||""); b.textContent=label; b.onclick=(e)=>{ e.stopPropagation(); fn(); }; foot.appendChild(b); return b; };
    if (!open){ /* verrouillé : rien à faire */ }
    else if (tr.noEngage){                            // échelle, combat libre : sans engagement
      btn(tr.format==="ladder" ? t("dispute") : t("freeFight"), "rc-btn--primary", ()=>disputeConcours(id));
    } else if (!st){
      btn(t("engage"), "rc-btn--primary", ()=>{
        const r = engageConcours(id);
        if (!r.ok){ showToast((r.fails&&r.fails[0]) || t("soon")); return; }
        renderLigueScreen(); saveState();
      });
    } else {
      btn(t("dispute"), "rc-btn--primary", ()=>disputeConcours(id));
      const ab = btn(t("abandon"), "rc-btn--ghost", ()=>{
        if (!ab._arm){ ab._arm = true; ab.textContent = t("confirmAbandon"); return; }   // deux taps
        abandonConcours(id); renderLigueScreen(); renderLigues();
      });
    }
    el.appendChild(card);
    // la progression du concours vit DANS sa vignette, pas en zone libre
    if (tr.id === "sumoM" && $("tourneyBanner")) card.appendChild($("tourneyBanner"));
    if (tr.format === "championnat" && st && $("champStandings")){ renderChampStandings(tr.id); card.appendChild($("champStandings")); }
    if (tr.format === "bracket" && st && $("bracketView")){ renderBracketView(tr.id); card.appendChild($("bracketView")); }
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
    const cap = Math.max(1, xs.length-1);                 // garde-fou : jamais le top-tier
    const pt = xs[Math.floor(rnd()*cap)];
    parts.push({ slot:sl, id:pt.id, wear:Math.round(20+rnd()*30), cost:pt.cost });
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
  S.garage.push(bot); S.activeBot = S.garage.length-1;
  S.usedBotOffer = null;                                   // vendu — retour demain
  syncActive(); recomputeOwned(); saveState();
  showToast(t("usedBotBought", {name:chassisName(o.chassis)}));
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
  { const b = { chassis:o.chassis, parts:{}, counts:{} };                 // E5 : le bot ASSEMBLÉ
    for (const p of o.parts){ const sl = DEF_SLOT[p.id]; if (sl) b.parts[sl] = p.id; }
    const cv = document.createElement("canvas"); cv.width = cv.height = 176;
    cv.style.width = "100%"; cv.style.height = "100%"; cv.style.display = "block";
    try { drawEditor(cv, b, autoArrange(b), 0, -1); } catch(e){}
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
  const TYPES = SLOT_ORDER.filter(x=>x!=="chassis" && !RETIRED_SLOTS[x]).map(x=>[x,"slot_"+x]);
  for (const [type, header] of TYPES){
    const h = document.createElement("div"); h.className = "rc-section";
    h.textContent = t(header);
    g.appendChild(h);
    const strip = document.createElement("div"); strip.className = "rc-carousel";
    g.appendChild(strip);
    if (ENGINE.PARTS[type].length === 1){
      strip.appendChild(mkPartCard(type, ENGINE.PARTS[type][0], true));
      continue;
    }
    for (const part of ENGINE.PARTS[type]) strip.appendChild(mkPartCard(type, part, false));
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
    const g = ENGINE.genOpponent(Math.floor(Math.random()*1e9), S.level);
    exhibOpp = { name:pickName(), archetype:g.archetype, build:g.build, level:S.level };
    return exhibOpp;
  }
  if (mode === "championnat"){
    const g = ENGINE.genOpponent(Math.floor(Math.random()*1e9), S.level);
    champOpp = { name: FORMATS.championnat.RIVALS[S.concours[curVsConcours].round % 5], archetype:g.archetype, build:g.build, level:S.level };
    return champOpp;
  }
  if (mode === "bracket"){
    const bst = S.concours[curVsConcours];
    const opp = FORMATS.bracket.myOpponent(bst);
    const g = ENGINE.genOpponent((bst.seed ^ (bst.round*7))>>>0, S.level);
    bracketOpp = { name: opp.name, archetype:g.archetype, build:g.build, level:S.level };
    return bracketOpp;
  }
  ensureOpponent(); return S.opponent;
}
function startMatch(mode){
  curMode = mode || (tournamentOpen() ? "tour" : "qual");
  const enemy = (vsMode === curMode && vsOpp) ? vsOpp : makeOpponent(curMode);

  const seed = Math.floor(Math.random()*1e9);
  // bracket: the build is LOCKED at entry — only pilot params (S.settings) change between bouts.
  const lock = (CN(MODE_CONCOURS[curMode]) || {}).lock || null;   // build gelé si le concours le déclare
  const pLayout = lock ? lock.layout : getLayout();
  const playerBuild = {...ENGINE.SLICE1.playerBuild, ...S.settings,
    chassis: lock ? lock.chassis : AB().chassis,
    parts: {...(lock ? lock.parts : S.parts.equipped)},
    counts: {...(lock ? (lock.counts||{}) : AB().counts)},
    color: lock ? lock.color : S.customize.color,
    stickers0: lock ? lock.stickers : S.customize.placed};
  ensureOppColor(enemy);
  // Pass 3: CG stability from the actual placement feeds the flip model.
  playerBuild.stability = computeCG(playerBuild, pLayout).stability;
  enemy.build.stability = computeCG(enemy.build, autoArrange(enemy.build)).stability;
  // WYSIWYG per-component hitbox from the same placement.
  playerBuild.colliders = buildColliders(playerBuild, pLayout);
  playerBuild.eff = buildEff(AB());                          // E3b : l'usure mord en combat
  enemy.build.colliders = buildColliders(enemy.build, autoArrange(enemy.build));
  match = ENGINE.makeMatch(seed, playerBuild, enemy.build);
  { const tr = curVsConcours ? tournamentById(curVsConcours) : null;             // S11b
    match.arenaSprite = arenaFor(tr && tr.arena); }
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
  const scale = w / (ENGINE.ARENA_R*2 + 6); // tight crop: max bot size on screen
  ctx.clearRect(0,0,w,w);
  ctx.save();
  const sx = (Math.random()-0.5)*shake, sy = (Math.random()-0.5)*shake;
  ctx.translate(w/2+sx, w/2+sy); ctx.scale(scale, scale);

  const AR=ENGINE.ARENA_R;
  const aimg = (match && match.arenaSprite) || arenaImg;          // S11b
  if(aimg && aimg.complete && aimg.naturalWidth>0){               // arena sprite as the static floor
    ctx.save(); ctx.beginPath(); ctx.arc(0,0,AR+6,0,Math.PI*2); ctx.clip();
    ctx.drawImage(aimg, -(AR+8), -(AR+8), (AR+8)*2, (AR+8)*2); ctx.restore();
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

  // live customisation: the player's colour/decals always reflect the CURRENT
  // choices (changing a colour then rematching shows instantly).
  match.bots[0].build.color = S.customize.color;
  match.bots[0].build.stickers0 = S.customize.placed;
  if (!match.bots[1].build.color) ensureOppColor({name:(S.opponent&&S.opponent.name)||"", build:match.bots[1].build});
  for (const bot of match.bots){
    // WYSIWYG: the live bot is the SAME editor visual — chassis + placed tiles.
    // editor "front" is up (−y); the bot faces +x, so add π/2 to align (cuit
    // dans renderBotComposite avec la culbute et le retournement).
    const fa = flipAnim[bot.id]||0;
    const flipped = bot.flippedT > 0;
    const layout = bot.id===0 ? getLayout() : autoArrange(bot.build);
    const comp = renderBotComposite(bot, layout, flipped, fa);
    // S11c — ombre portée : silhouette exacte, lumière FIXE-MONDE (bas-droite),
    // décollée pendant la culbute, resserrée quand le bot gît sur le dos.
    const lift = 1 + fa*1.6;
    ctx.save();
    ctx.translate(bot.pos.x + 4*lift, bot.pos.y + 8*lift);
    ctx.rotate(bot.angle);
    ctx.globalAlpha = flipped ? 0.24 : 0.34;
    if ("filter" in ctx) ctx.filter = "blur(" + (2.2*lift).toFixed(1) + "px)";
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

function drawChassisPath(c, kind, r){
  c.beginPath();
  if (kind==="wedge"){
    c.moveTo(r*1.15,0); c.lineTo(-r*0.8,-r*0.85); c.lineTo(-r*0.8,r*0.85); c.closePath();
  } else if (kind==="dart"){
    c.moveTo(r*1.1,0); c.lineTo(-r*0.6,-r*0.6);
    c.lineTo(-r*0.9,0); c.lineTo(-r*0.6,r*0.6); c.closePath();
  } else {
    const w=r*0.95;
    c.rect(-w,-w,w*2,w*2);
  }
}

/* ============================================================
   COMPONENT RENDERING — one primitive per part, assembled.
   All motion is sim-driven (match.t, odometer, throttle): deterministic,
   no CSS keyframes. anim = {t, odo, vib}.
   ============================================================ */
function shade(hex, f){
  const n = parseInt(hex.slice(1),16);
  let R=(n>>16)&255, G=(n>>8)&255, B=n&255;
  R=Math.min(255,R*f)|0; G=Math.min(255,G*f)|0; B=Math.min(255,B*f)|0;
  return `rgb(${R},${G},${B})`;
}
function rr(c,x,y,w,h,rad){
  c.beginPath();
  if (c.roundRect) c.roundRect(x,y,w,h,rad);
  else { c.rect(x,y,w,h); }
  c.closePath();
}
// wheel geometry comes from the chassis, STYLE from the tires part
function wheelGeom(kind, r){
  if (kind==="dart")  return {x:-r*0.5, len:r*1.1, w:r*0.32, y:r*0.63};
  if (kind==="wedge") return {x:-r*0.7, len:r*0.9, w:r*0.40, y:r*0.58};
  return {x:-r*0.85, len:r*1.7, w:r*0.42, y:r*0.70}; // boxy
}
function drawTires(c, r, kind, style, anim){
  const tid = {worn:"t0", lug:"t1", slick:"t2", tread:"t3"}[style] || "t0";
  const g = wheelGeom(kind, r);
  const roll = anim.odo*0.14; // lug travel, sim-driven
  for (const side of [-1,1]){
    const y = side<0 ? -g.y-g.w : g.y;
    c.fillStyle = "#15171d";
    rr(c, g.x, y, g.len, g.w, 3); c.fill();
    if (tid==="t1"){                         // lug tires: chunky notches
      c.fillStyle = "#0c0d11";
      const sp = g.len/3.2;
      for (let i=-1;i<4;i++){
        const x = g.x + ((i*sp + roll) % (g.len+sp) + (g.len+sp)) % (g.len+sp) - sp*0.5;
        if (x>g.x-2 && x<g.x+g.len-2) c.fillRect(x, y, r*0.10, g.w);
      }
    } else if (tid==="t2"){                  // soft slicks: wider + sheen band
      c.fillStyle = "#22252e";
      rr(c, g.x, y - side*g.w*0.12, g.len, g.w*1.12, 3); c.fill();
      c.fillStyle = "rgba(255,255,255,.10)";
      c.fillRect(g.x, y+g.w*0.32, g.len, g.w*0.18);
    } else if (tid==="t3"){                  // steel treads: plates + moving lugs
      c.fillStyle = "#1b1e26";
      rr(c, g.x-r*0.06, y-side*g.w*0.10, g.len+r*0.12, g.w*1.10, 4); c.fill();
      c.fillStyle = "#3a3f4d";
      const sp = g.len/4;
      for (let i=-1;i<5;i++){
        const x = g.x + ((i*sp + roll) % (g.len+sp) + (g.len+sp)) % (g.len+sp) - sp*0.5;
        if (x>g.x-2 && x<g.x+g.len-4) c.fillRect(x, y, r*0.09, g.w);
      }
    } else {                                  // t0 worn rubber: plain, a faint roll line
      c.fillStyle = "rgba(255,255,255,.06)";
      const x = g.x + ((roll) % g.len + g.len) % g.len;
      c.fillRect(x, y, 2, g.w);
    }
  }
}
function drawShell(c, r, kind, base, dark, light){
  c.fillStyle = base;
  drawChassisPath(c, kind, r); c.fill();
  c.save(); drawChassisPath(c, kind, r); c.clip();
  c.fillStyle = light; c.globalAlpha = 0.18;
  c.fillRect(-r*1.2, -r*1.2, r*2.4, r*1.1);
  c.globalAlpha = 1; c.restore();
  c.lineJoin = "round";
  if (kind==="boxy"){
    c.strokeStyle = dark; c.lineWidth = 1.4;
    c.strokeRect(-r*0.5, -r*0.5, r*1.0, r*1.0);      // top hatch
    c.fillStyle = dark;
    for (const sx of [-1,1]) for (const sy of [-1,1]){
      c.beginPath(); c.arc(sx*r*0.72, sy*r*0.72, r*0.1, 0,7); c.fill(); }
  } else if (kind==="wedge"){
    c.strokeStyle = light; c.lineWidth = 2;           // scoop lip
    c.beginPath(); c.moveTo(r*1.1,-r*0.06); c.lineTo(-r*0.75,-r*0.8);
    c.moveTo(r*1.1,r*0.06); c.lineTo(-r*0.75,r*0.8); c.stroke();
    c.strokeStyle = dark; c.lineWidth = 1.4;          // rear vents
    for (let i=0;i<3;i++){ const x=-r*0.75+i*r*0.16;
      c.beginPath(); c.moveTo(x,-r*0.5); c.lineTo(x,r*0.5); c.stroke(); }
  } else {                                            // dart spine
    c.strokeStyle = light; c.lineWidth = 2;
    c.beginPath(); c.moveTo(r*1.05,0); c.lineTo(-r*0.7,0); c.stroke();
    c.strokeStyle = dark; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(r*0.2,-r*0.28); c.lineTo(-r*0.5,-r*0.4);
    c.moveTo(r*0.2,r*0.28); c.lineTo(-r*0.5,r*0.4); c.stroke();
  }
}
const MOTOR_STYLE = {
  m0:{col:"#6e5238", fins:1, w:0.55}, m1:{col:"#7d8494", fins:2, w:0.60},
  m2:{col:"#5a7d9e", fins:3, w:0.66}, m3:{col:"#3a3f4c", fins:4, w:0.80, band:"#e8862e"},
  m4:{col:"#a8352f", fins:2, w:0.58, intake:true},
};
function drawMotor(c, r, mid, anim){
  const st = MOTOR_STYLE[mid] || MOTOR_STYLE.m0;
  const bw = r*st.w, bh = r*0.42;
  c.save();
  // vibration: sim-time jitter scaled by throttle
  const j = anim.vib * 0.9;
  c.translate(-r*0.42 + Math.sin(anim.t*55)*j*0.6, Math.cos(anim.t*47)*j*0.5);
  c.fillStyle = st.col;
  rr(c, -bw/2, -bh/2, bw, bh, 2); c.fill();
  c.fillStyle = "rgba(0,0,0,.35)";
  for (let i=1;i<=st.fins;i++){
    const x = -bw/2 + i*bw/(st.fins+1);
    c.fillRect(x, -bh/2, 1.4, bh);
  }
  if (st.band){ c.fillStyle = st.band; c.fillRect(-bw/2, bh*0.14, bw, bh*0.2); }
  if (st.intake){ c.fillStyle = "#1a1c22";
    c.beginPath(); c.arc(bw*0.32, 0, bh*0.24, 0, 7); c.fill(); }
  c.restore();
}
const BATT_STYLE = {
  b0:{col:"#5b5f6a", n:1, w:0.34}, b1:{col:"#3f8f5a", n:1, w:0.38},
  b2:{col:"#3f8f5a", n:2, w:0.46}, b3:{col:"#2c3038", n:0, w:0.52, hex:true},
};
function drawBattery(c, r, bid){
  const st = BATT_STYLE[bid] || BATT_STYLE.b0;
  const bw = r*st.w, bh = r*0.30;
  c.save(); c.translate(r*0.10, r*0.44);
  c.fillStyle = st.col;
  rr(c, -bw/2, -bh/2, bw, bh, 2); c.fill();
  c.fillStyle = "rgba(255,255,255,.25)";
  for (let i=0;i<st.n;i++) c.fillRect(-bw/2 + 2 + i*(bw/2), -bh/2+2, 1.6, bh-4);
  if (st.hex){ c.fillStyle = "#57d98f";
    for (let i=0;i<3;i++){ c.beginPath();
      c.arc(-bw/2 + bw*(0.25+0.25*i), 0, 1.4, 0, 7); c.fill(); } }
  c.restore();
}
function noseX(kind){ return kind==="wedge" ? 1.15 : kind==="dart" ? 1.1 : 0.95; }
function drawPlow(c, r, pid, kind){
  if (!pid || pid==="a0" || pid==="p0") return;
  const nx = noseX(kind)*r;
  c.fillStyle = "#8a9099";
  if (pid==="a1"){                                    // bumper: short flat bar
    rr(c, nx-r*0.03, -r*0.5, r*0.13, r*1.0, 2); c.fill();
  } else if (pid==="a2" || pid==="p1"){               // steel blade
    rr(c, nx-r*0.04, -r*0.72, r*0.2, r*1.44, 2); c.fill();
    c.fillStyle = "rgba(0,0,0,.3)";
    c.fillRect(nx-r*0.04, -r*0.72, r*0.05, r*1.44);
  } else {                                            // fork (a3): two prongs
    rr(c, nx-r*0.06, -r*0.62, r*0.42, r*0.17, 2); c.fill();
    rr(c, nx-r*0.06,  r*0.45, r*0.42, r*0.17, 2); c.fill();
    c.fillStyle = "#6d737d";
    rr(c, nx-r*0.10, -r*0.66, r*0.10, r*1.32, 2); c.fill();
  }
}
function drawExtras(c, r, parts, anim){
  // sensors: mast dot up front (n1), + sweep ring (n2, sim-time rotation)
  const sn = parts.sensors;
  if (sn==="n1" || sn==="n2"){
    c.fillStyle = "#8fd0ff";
    c.beginPath(); c.arc(r*0.28, 0, r*0.09, 0, 7); c.fill();
    if (sn==="n2"){
      c.strokeStyle = "rgba(143,208,255,.7)"; c.lineWidth = 1.2;
      const a = anim.t*2.4;
      c.beginPath(); c.arc(r*0.28, 0, r*0.2, a, a+1.6); c.stroke();
    }
  }
  // ballast: dark slabs amidships
  const ls = parts.ballast;
  if (ls==="l1" || ls==="l2"){
    c.fillStyle = "#2a2d35";
    rr(c, -r*0.16, -r*0.5, r*0.42, r*0.2, 2); c.fill();
    if (ls==="l2"){ rr(c, -r*0.16, -r*0.26, r*0.42, r*0.2, 2); c.fill(); }
  }
  // srimech: arm across the rear deck
  const sr = parts.srimech;
  if (sr==="r1" || sr==="r2"){
    c.fillStyle = sr==="r2" ? "#c8cdd6" : "#9aa0ab";
    rr(c, -r*0.62, -r*0.55, r*0.16, r*1.1, 3); c.fill();
    c.fillStyle = "#3a3f4c";
    c.beginPath(); c.arc(-r*0.54, 0, r*0.08, 0, 7); c.fill();
  }
  // cooling: vent slits on the flank opposite the battery
  const ko = parts.cooling;
  if (ko==="k1" || ko==="k2"){
    c.strokeStyle = ko==="k2" ? "#7fd4e8" : "rgba(0,0,0,.4)"; c.lineWidth = 1.3;
    for (let i=0;i<3;i++){
      c.beginPath(); c.moveTo(r*0.02+i*r*0.14, -r*0.58);
      c.lineTo(r*0.10+i*r*0.14, -r*0.36); c.stroke();
    }
  }
}
function drawHeadlight(c, r, isPlayer, anim, id){
  const pulse = 0.65 + 0.35*(0.5+0.5*Math.sin(anim.t*3.1 + id*1.7));
  if (isPlayer){
    c.fillStyle = `rgba(255,209,102,${pulse})`;       // Rusty: yellow, off-center
    c.beginPath(); c.arc(r*0.6, -r*0.22, r*0.13, 0,7); c.fill();
  } else {
    c.fillStyle = `rgba(255,255,255,${0.6*pulse+0.15})`;
    c.beginPath(); c.arc(r*0.55, 0, r*0.12, 0,7); c.fill();
  }
}
function drawWear(c, kind, r){                        // Rusty's story
  c.save(); drawChassisPath(c, kind, r); c.clip();
  c.fillStyle = "#6b7079";                            // mismatched riveted panel
  rr(c, -r*0.82, -r*0.12, r*0.5, r*0.55, 2); c.fill();
  c.fillStyle = "#4c515b";
  c.beginPath(); c.arc(-r*0.72,-r*0.02,r*0.05,0,7); c.fill();
  c.beginPath(); c.arc(-r*0.72, r*0.33,r*0.05,0,7); c.fill();
  c.fillStyle = "rgba(168,92,44,.4)";                 // rust streaks
  c.beginPath(); c.arc(-r*0.15, r*0.5, r*0.18, 0,7); c.fill();
  c.beginPath(); c.arc(r*0.42, -r*0.5, r*0.12, 0,7); c.fill();
  c.strokeStyle = "rgba(0,0,0,.28)"; c.lineWidth = 1; // a single scratch
  c.beginPath(); c.moveTo(-r*0.05,-r*0.55); c.lineTo(r*0.35,-r*0.18); c.stroke();
  c.restore();
}
function drawBot(c, bot, color, isPlayer, anim){
  const r = bot.radius, kind = bot.build.chassis;
  const parts = bot.build.parts || {};
  const flipped = bot.flippedT > 0;
  const base = flipped ? "#777f92" : (isPlayer ? shade(color,0.82) : color);
  const dark = shade(base,0.62), light = shade(base,1.28);

  const propStyle = (ENGINE.partOf("propulsion", parts.propulsion)||{}).style || "worn";
  drawTires(c, r, kind, propStyle, anim);
  drawShell(c, r, kind, base, dark, light);
  if (flipped){                                       // belly-up: pale underside
    c.fillStyle = shade(base,1.15); c.globalAlpha=0.5;
    drawChassisPath(c, kind, r*0.7); c.fill(); c.globalAlpha=1;
    return;
  }
  drawBattery(c, r, parts.battery||"b0");
  drawMotor(c, r, parts.motor||"m0", anim);
  drawPlow(c, r, parts.armor, kind);
  drawExtras(c, r, parts, anim);
  drawHeadlight(c, r, isPlayer, anim, bot.id||0);
  if (isPlayer) drawWear(c, kind, r);
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
  const won = m.winner === 0;
  renderDebrief(match);
  $("ovTitle").textContent = t(won ? "win" : "lose");
  $("ovTitle").style.color = won ? "var(--good)" : "var(--red)";
  let cause = t(causeKey(m));
  if (wasForfeit) cause = t("forfeited")+" "+cause;
  $("ovCause").textContent = cause;

  // --- bolts ---
  const w = WIN_BOLTS[S.level];
  let earned;
  if (wasForfeit) earned = Math.max(1, Math.ceil(w*0.1));
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
      $("ovTitle").textContent = (pr.champ ? t("bracketChamp") : t("bracketOut")) + " 🏆";
      $("ovTitle").style.color = "var(--accent)";
      unlockEl.textContent = t("bracketPrize", {total:pr.total}); unlockEl.style.display = "block";
      if (pr.champ && bid === "cupS" && !S.sPrimeAwarded){          // E4 : PRIME DE MONTÉE, une fois
        S.sPrimeAwarded = true; S.bolts += 200; showToast(t("sPrime"));
      }
      S.concours[bid] = null;
      $("ovMain").textContent = t("nextOpp");
    }
  } else if (curMode === "championnat"){
    const cid = curVsConcours, cst = S.concours[cid];
    const done = FORMATS.championnat.recordMatch(cst, m.duels[0]);   // your duels this bout (0..2)
    const rank = FORMATS.championnat.myRank(cst);
    if (!done){
      $("ovMain").textContent = t("champRound", {r:cst.round+1, n:cst.rounds, rank});
    } else {
      const pr = FORMATS.championnat.prize(cst, w);
      pr.total = Math.round(pr.total*purseMult(cid));                          // E1 : bourse ×ligue
      S.bolts += pr.total;
      S.concoursDone[cid] = true;
      $("ovTitle").textContent = t("champDone")+" 🏁"; $("ovTitle").style.color = "var(--accent)";
      unlockEl.textContent = t("champPrize", {rank:pr.rank, total:pr.total}); unlockEl.style.display = "block";
      S.concours[cid] = null;
      $("ovMain").textContent = t("nextOpp");
    }
  } else { // qual or exhib
    if (realWin){
      S.beaten++;
      if (curMode === "qual"){ S.beatenAtLevel++; S.opponent = null; }
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
  hist: 0,  // entrées history poussées par nous, pas encore consommées
  eat: 0,   // popstate à ignorer (échos de notre propre history.back())
  show(id){
    for (const sc of ["homeScreen","ligueScreen","vsScreen","matchScreen"]) $(sc).style.display = (sc===id) ? "block" : "none";
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

$("fightBtn").onclick = ()=> startMatch(vsMode || (tournamentOpen() ? "tour" : "qual"));
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
  $("overlay").style.display="none";
  const realWin = match.winner === 0 && !wasForfeit;
  const goHome = ()=>NAV.uiBack();
  if (realWin) goHome();                    // scout the next opponent / bracket match
  else if (curMode === "exhib") goHome();   // lost friendly: no forced rematch loop
  else if (curMode === "championnat") goHome();  // le championnat joue ses 10 manches, gagné ou perdu
  else if (curMode === "bracket") goHome(); // bracket: win→next round, loss→eliminated
  else startMatch(curMode);                 // retry (tournament restarts at match 1)
};
$("ovBack").onclick = ()=>{ $("overlay").style.display="none"; NAV.uiBack(); };
/* P2 — panneau de reglages : langue + comparatif de versions */
function renderVersionsTable(){
  const tb = $("verTable"); if(!tb) return; tb.innerHTML = "";
  const cache = "v41";                                        // repere de build (CACHE du SW)
  const rows = [[t("verRow_app"), "PWA", "Single-file"],
                [t("verRow_build"), cache, "2025"],
                [t("verRow_install"), "✓", "✗"],
                [t("verRow_off"), "✓", "✗"],
                [t("verRow_maj"), "✓", "✗"],
                [t("verRow_save"), t("verSaveV4"), t("verSaveOld")]];
  rows.forEach((r,i)=>{ const tr=document.createElement("tr");
    r.forEach(v=>{ const td=document.createElement(i?"td":"th"); td.textContent=v; tr.appendChild(td); });
    tb.appendChild(tr); });
}
$("settingsBtn").onclick = ()=>{ renderVersionsTable(); $("settingsOv").style.display="flex"; };
$("settingsClose").onclick = ()=>{ $("settingsOv").style.display="none"; };
document.querySelectorAll("#langSeg .rc-seg__opt").forEach(o=>{
  o.onclick = ()=>{ LANG = o.dataset.lang; S.lang = LANG; saveState(); renderHome(); };
});
window.addEventListener("resize", ()=>{ if (match && !match.over) setupCanvas(); });

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
renderHome();
showTab(activeTab);
