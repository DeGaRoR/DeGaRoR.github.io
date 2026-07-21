/* app.js — couche application : état, éditeur, tournois, rendu, UI.
   Dépend de data.js (STRINGS, sprites, TIERS) et de engine.js (ENGINE). */
/* ============================================================
   ENGINE (pure, deterministic, no DOM) — extractable for tests
   ============================================================ */


/* ============================================================
   I18N
   ============================================================ */

let LANG = "fr";
const t = (k, vars) => {
  let s = (STRINGS[LANG][k] ?? STRINGS.en[k] ?? k);
  if (vars) for (const [kk,vv] of Object.entries(vars)) s = s.split("{"+kk+"}").join(vv);
  return s;
};

const OPP_NAMES = ["GRIZZLI","TRANCHE","RIVET","PIKPIK","MAMMOUTH","VORTEX","CAFARD",
  "TAUPE","FURIE","CROC","PATATE","BOULON"];

/* ============================================================
   STATE (localStorage, guarded)
   ============================================================ */
const SKEY = "roboclash_s4";
function defaultState(){
  return {
    lang:"fr", beaten:0, speed:1,           // beaten = qualifier+friendly wins (param unlocks)
    level:1, beatenAtLevel:0,               // 2 qualifier wins open the tournament
    bolts:0,
    parts:{
      owned:{ propulsion:["pr0"], motor:["m0"], cpu:["c0"], battery:["b0"],
        armor:[], weapon1:[], weapon2:[], software:[],
        ballast:[], sensors:["n0"], srimech:[], cooling:[] },
      equipped:{ propulsion:"pr0", motor:"m0", cpu:"c0", battery:"b0",
        armor:null, weapon1:null, weapon2:null, software:null,
        ballast:null, sensors:"n0", srimech:null, cooling:null },
    },
    badges:[], champion:false,
    customize:{ color:"#59627a", stickers:[], placed:[] },
    layout:null,                            // per-slot editor positions (null = defaults)
    tourney:null,                           // {idx, opponents:[{name,archetype,build,level}x3]}
    settings:{...ENGINE.SLICE1.playerBuild},
    opponent:null,                          // current qualifier {name, archetype, build, level}
  };
}

// stackable internal slots (L3.5 multiplicity) — declared here: read during boot by installedElsewhere()
const STACK_SLOTS = { motor:1, battery:1, cooling:1, ballast:1 };
// a chassis is valid only if the engine knows it; unknown → fall back rather than crash.
// ENGINE-side registries only: app-layer CHASSIS_SPEC is declared after the boot block.
function validChassis(ch){ return (ch && ENGINE.PHYS.chassis[ch] && ENGINE.CHASSIS[ch]) ? ch : "boxy"; }
/* A3 — slots optionnels. La pièce d'indice 0 d'un slot à masse 0 ET coût 0 n'est
   pas un objet : c'est l'ABSENCE. L'état stocke null pour ces slots ; le moteur
   garde son descripteur zéro (partOf(slot,null) le résout). Dérivé des données :
   armor, weapon1, weapon2, software, ballast, srimech, cooling. */
const EMPTY_ID = {}, OPTIONAL_SLOTS = {};
for (const sl of Object.keys(ENGINE.PARTS)){ const p0 = ENGINE.PARTS[sl][0];
  if (p0.cost === 0 && ENGINE.partMassKg(sl, p0.id) === 0){ OPTIONAL_SLOTS[sl] = true; EMPTY_ID[sl] = p0.id; } }
const normEquip = (slot, id) => (OPTIONAL_SLOTS[slot] && id === EMPTY_ID[slot]) ? null : id;
// ---- L1 Garage & Inventory: a bot = chassis + loadout; parts live in a shared pool ----
function defaultBot(chassis){
  return { chassis: validChassis(chassis),
    equipped:{ propulsion:"pr0", motor:"m0", cpu:"c0", battery:"b0", armor:null,
      weapon1:null, weapon2:null, software:null, ballast:null, sensors:"n0", srimech:null, cooling:null },
    customize:{ color:"#59627a", stickers:[], placed:[] }, layout:null, counts:{} }; }
function AB(){ return S.garage[S.activeBot]; }                       // active bot (source of truth)
function syncActive(){ const b=AB(); S.parts=S.parts||{}; S.parts.equipped=b.equipped; S.customize=b.customize; } // live pointers
function invCount(id){ return (S.inventory&&S.inventory[id])||0; }   // total copies owned
function installedElsewhere(id){ let n=0; S.garage.forEach((b,i)=>{ if(i===S.activeBot) return;
  for(const s in b.equipped) if(b.equipped[s]===id) n += (b.counts&&STACK_SLOTS[s]?(b.counts[s]||1):1); }); return n; }
function availFor(id){ return invCount(id) - installedElsewhere(id); } // copies free for the active bot
function recomputeOwned(){ // rebuild S.parts.owned for the active bot: a part shows if a copy is free (or it's already equipped here)
  const owned={}, eq=AB().equipped;
  for(const slot in eq){ owned[slot]=[];
    for(const p of (ENGINE.PARTS[slot]||[])){ const id=p.id;
      if((OPTIONAL_SLOTS[slot] && id===EMPTY_ID[slot])            // « vide » : toujours proposé, jamais possédé
         || (invCount(id)>0 && (availFor(id)>=1 || eq[slot]===id))) owned[slot].push(id); }
    if(!owned[slot].length) owned[slot]=[eq[slot]]; }
  S.parts.owned=owned; }

// tier-based mods (slice 2 saves) -> parts chain
function modsToParts(mods){
  const m = mods || {};
  const chain = (list, n) => list.slice(0, Math.max(1, (n||0)+1));
  const owned = {
    motor:   chain(["m0","m1","m2"], m.motor),
    battery: chain(["b0","b1","b2"], m.battery),
    tires:   chain(["t0","t1","t2"], m.tires),
    plow:    (m.plow ? ["p0","p1"] : ["p0"]),
  };
  return { owned, equipped:{ motor:owned.motor[owned.motor.length-1],
    battery:owned.battery[owned.battery.length-1],
    tires:owned.tires[owned.tires.length-1],
    plow:owned.plow[owned.plow.length-1] } };
}
// s3 saves: tires -> propulsion (t*->pr*), plow -> armor (p*->a*), new slots stock
function s3PartsToS4(p3){
  const d = defaultState().parts;
  if (!p3 || !p3.owned) return d;
  const mapIds = (arr, from, to) => (arr||[]).map(id=>id.replace(from,to));
  d.owned.motor = p3.owned.motor || ["m0"];
  d.owned.battery = p3.owned.battery || ["b0"];
  d.owned.propulsion = mapIds(p3.owned.tires, "t", "pr");
  d.owned.armor = mapIds(p3.owned.plow, "p", "a");
  const e = p3.equipped || {};
  d.equipped.motor = e.motor || "m0";
  d.equipped.battery = e.battery || "b0";
  d.equipped.propulsion = (e.tires||"t0").replace("t","pr");
  d.equipped.armor = (e.plow||"p0").replace("p","a");
  return d;
}
let S = defaultState();
try {
  const raw = localStorage.getItem(SKEY);
  if (raw) S = {...defaultState(), ...JSON.parse(raw)};
  else if (localStorage.getItem("roboclash_s3")){
    const o = JSON.parse(localStorage.getItem("roboclash_s3"));
    S = {...defaultState(), lang:o.lang??"fr", speed:o.speed??1,
      settings:{...S.settings, ...(o.settings||{})},
      beaten:o.beaten||0, level:o.level||1, beatenAtLevel:o.beatenAtLevel||0,
      bolts:o.bolts||0, badges:o.badges||[], champion:!!o.champion,
      parts:s3PartsToS4(o.parts), tourney:null, opponent:null};
  }
  else {
    const s2 = localStorage.getItem("roboclash_s2");
    const s1 = localStorage.getItem("roboclash_s1");
    if (s2){ // migrate slice-2: mods -> parts; opponents regenerate (their builds carried mods)
      const o = JSON.parse(s2);
      S = {...defaultState(), lang:o.lang??"fr", speed:o.speed??1,
        settings:{...S.settings, ...(o.settings||{})},
        beaten:o.beaten||0, level:o.level||1, beatenAtLevel:o.beatenAtLevel||0,
        bolts:o.bolts||0, badges:o.badges||[], champion:!!o.champion,
        parts:s3PartsToS4(modsToParts(o.mods)), tourney:null, opponent:null};
    } else if (s1){ // migrate slice-1
      const o = JSON.parse(s1);
      S = {...defaultState(), lang:o.lang??"fr", speed:o.speed??1,
        settings:{...S.settings, ...(o.settings||{})},
        beaten:o.beaten||0, opponent:null};
      S.level = Math.min(5, 1 + Math.floor(S.beaten/2));
      S.beatenAtLevel = Math.min(2, S.beaten % 2);
      S.bolts = S.beaten * 20; // grandfather earnings
    }
  }
} catch(e){}
if (!S.parts || !S.parts.owned || !S.parts.owned.propulsion) S.parts = defaultState().parts;
if (!S.customize) S.customize = { color:"#59627a", stickers:[], placed:[] };
if (!S.customize.placed){ S.customize.placed = []; 
  if (S.customize.sticker) S.customize.placed.push({id:S.customize.sticker, col:4, row:4}); delete S.customize.sticker; }
// L1: assemble garage + shared inventory (from a modern save, or migrated from flat parts)
if (!S.garage || !S.garage.length){
  const bot = defaultBot("boxy");
  bot.equipped = {...bot.equipped, ...((S.parts&&S.parts.equipped)||{})};
  bot.customize = S.customize || bot.customize;
  bot.layout = (S.layout!==undefined) ? S.layout : null;
  S.garage=[bot]; S.activeBot=0;
  S.inventory={};
  const owned=(S.parts&&S.parts.owned)||{};
  for(const slot in owned) for(const id of owned[slot]) S.inventory[id]=(S.inventory[id]||0)+1;
  for(const sl in bot.equipped){ const id=bot.equipped[sl]; if(id && !S.inventory[id]) S.inventory[id]=1; }
}
if (S.activeBot==null || S.activeBot>=S.garage.length) S.activeBot=0;
S.garage.forEach(b=>{ if(!b.counts) b.counts={}; b.chassis = validChassis(b.chassis); });
if (S.bracket && S.bracket.lock) S.bracket.lock.chassis = validChassis(S.bracket.lock.chassis);
if (!S.inventory) S.inventory={};
/* A2 — format de sauvegarde versionné. v absent = 1 (format s4 historique,
   réparé par les gardes ci-dessus). Chaque migration transforme v → v+1 et ne
   touche QUE les données. Règle : on ne bosse jamais SAVE_V sans écrire la
   migration correspondante (même vide et commentée). Une sauvegarde d'une
   version FUTURE n'est jamais rétrogradée ni mutée. */
const SAVE_V = 3;
const MIGRATIONS = {
  1: (S)=>{ /* 1→2 : pose du champ de version ; aucun changement structurel. */ },
  2: (S)=>{ /* 2→3 : slots optionnels vides → null ; purge des pseudo-pièces.
               Table volontairement FIGÉE (une migration décrit le passé,
               elle ne lit jamais les données vivantes). */
    const EMPT = { armor:"a0", weapon1:"w0", weapon2:"x0", software:"s0",
                   ballast:"l0", srimech:"r0", cooling:"k0" };
    const scrub = (eq)=>{ if(eq) for(const sl in EMPT) if(eq[sl]===EMPT[sl]) eq[sl]=null; };
    (S.garage||[]).forEach(b=>scrub(b.equipped));
    scrub(S.parts && S.parts.equipped);
    scrub(S.bracket && S.bracket.lock && S.bracket.lock.parts);
    if (S.inventory) for(const sl in EMPT) delete S.inventory[EMPT[sl]];
  },
};
function migrateState(S){
  let v = S.v || 1;
  if (v > SAVE_V) return S;                 // sauvegarde plus récente que le code : intacte
  while (v < SAVE_V){ const m = MIGRATIONS[v]; if (m) m(S); v++; }
  S.v = SAVE_V; return S;
}
migrateState(S);
syncActive(); recomputeOwned();
function saveState(){ try{ localStorage.setItem(SKEY, JSON.stringify(S)); }catch(e){} }
LANG = S.lang;

const WIN_BOLTS = [0, 10, 18, 30, 50, 85]; // by level — halved: ~2× slower progression to L5
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
const PLAYER_COLOR = "#4da3ff", ENEMY_COLOR = "#ff5252";

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
  $("boltsLabel").textContent = S.bolts + " 🔩";
  $("badgesLabel").textContent = S.badges.length ? " " + "🏅".repeat(S.badges.length) : "";
  $("langBtn").textContent = LANG.toUpperCase();

  // tournament banner + friendly button
  const banner = $("tourneyBanner");
  if (inTourney){
    banner.style.display = "block";
    $("tourneyTitle").textContent = t("tourneyTitle", {l:S.level, i:S.tourney.idx+1});
    const prize = WIN_BOLTS[S.level]*5;
    $("tourneyPrize").textContent = S.level >= 5
      ? t("tourneyChampPrize", {p:prize})
      : t("tourneyPrize", {p:prize, n:S.level+1});
    $("friendlyBtn").style.display = "block";
  } else {
    banner.style.display = "none";
    $("friendlyBtn").style.display = "none";
  }

  // scouting: tournament bracket opponent, or current qualifier
  const o = inTourney ? S.tourney.opponents[S.tourney.idx] : S.opponent;
  $("oppName").textContent = o.name;
  $("oppClass").textContent = t(weightClass(o.build)) + " · " +
    ENGINE.physStats(o.build).massKg.toFixed(2) + " kg";
  $("oppWeight").textContent = t("level")+" "+o.level;
  $("oppTend").textContent = t(ENGINE.tendencyKey(o.build));
  renderNums($("oppNums"), {...o.build, power:"mixed"});
  ensureOppColor(o);
  $("scoutCv")._oppBuild = o.build;
  drawEditor($("scoutCv"), o.build, autoArrange(o.build), editSpin, -1);

  // player settings: behavior params (pilot), then power (machine)
  const rows = $("paramRows"); rows.innerHTML = "";
  const behaviorKeys = ["strategy","aggression","edgeGuard","approach","chargeDist","handling"];
  for (const key of behaviorKeys) rows.appendChild(makeSeg(key));
  $("styleLine").textContent = t("styleLabel")+" "+t(ENGINE.tendencyKey(S.settings));

  const pr = $("powerRow"); pr.innerHTML = ""; pr.appendChild(makeSeg("power"));

  // player machine: live numbers + robot editor with equipped parts
  const myBuild = {...S.settings, chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}, color:S.customize.color, stickers0:S.customize.placed};
  renderNums($("myNums"), myBuild);
  bindEditor();
  renderLayerTabs();
  drawEditor($("editorCv"), myBuild, getLayout(), editSpin, editFocus, showCG, showHB);

  // fight-tab player card (same visual as the editor → WYSIWYG)
  $("playerClass").textContent = t(weightClass(myBuild)) + " · " + ENGINE.physStats(myBuild).massKg.toFixed(2) + " kg";
  renderNums($("playerNums"), myBuild);
  $("playerCv")._build = myBuild;
  drawEditor($("playerCv"), myBuild, getLayout(), editSpin, -1);

  // stat bars (react to Power AND equipped parts)
  const bars = ENGINE.statBars(myBuild);
  const names = {speed:"stSpeed", push:"stPush", leverage:"stLeverage",
                 traction:"stTraction", energy:"stEnergy"};
  const sb = $("statBars"); sb.innerHTML = "";
  for (const [k,frac] of Object.entries(bars)){
    const s = document.createElement("div"); s.className="stat";
    s.innerHTML = `${t(names[k])}<div class="bar"><i style="width:${Math.round(frac*100)}%"></i></div>`;
    sb.appendChild(s);
  }

  renderTournaments();
  renderBracketView();
  renderLeagueStandings();
  renderGarage();
  renderGarageStrip();
  renderWorkshop();
  renderCustomize();

  document.querySelectorAll("[data-i18n]").forEach(el=>el.textContent = t(el.dataset.i18n));
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
    if(!S.customize.stickers.length){ const hint=document.createElement("div");
      hint.className="stickerhint"; hint.textContent=t("stickerShopHint"); sr.appendChild(hint); }
    for(const id of S.customize.stickers){ const st=stickerOf(id); if(!st) continue;
      const count=S.customize.placed.filter(p=>p.id===id).length;
      const sw=document.createElement("div");
      sw.className="swatch"+(count?" on":""); sw.textContent=st.emoji;
      sw.title=t("stickerPlace");
      if(count>1){ const badge=document.createElement("div"); badge.className="px"; badge.textContent="×"+count; sw.appendChild(badge); }
      sw.onclick=()=>{ // each tap adds ONE MORE copy; drag it off the hull to remove
        const cell=freeChassisCell({chassis:AB().chassis,parts:{...S.parts.equipped}, counts:{...AB().counts}}, getLayout())||{col:4.5,row:4};
        S.customize.placed.push({id, col:cell.col, row:cell.row});
        saveState(); renderCustomize();
      };
      sr.appendChild(sw); }
    if(S.customize.placed.length){ const hint=document.createElement("div");
      hint.className="stickerhint"; hint.textContent=t("stickerDragHint"); sr.appendChild(hint); }
  }
}

function makeSeg(key){
  const unlocked = isUnlocked(key);
  const row = document.createElement("div"); row.className = unlocked ? "row" : "row locked";
  const lab = document.createElement("label");
  const need = CONTROL_TIER[key];
  lab.textContent = unlocked ? t(key) : (t(key)+"  🔒 "+t("pn_s"+need));
  const wrap = document.createElement("div"); wrap.className="selwrap";
  const sel = document.createElement("select"); sel.className="param"; sel.disabled = !unlocked;
  if(!unlocked && S.settings[key]!==ENGINE.OPTS[key][0]){ S.settings[key]=ENGINE.OPTS[key][0]; }
  ENGINE.OPTS[key].forEach(opt=>{
    const o = document.createElement("option");
    o.value = opt; o.textContent = t(opt);
    if (S.settings[key]===opt) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = ()=>{ if(!isUnlocked(key)) return; S.settings[key]=sel.value; saveState(); renderHome(); };
  wrap.appendChild(sel);
  row.appendChild(lab); row.appendChild(wrap);
  return row;
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
const DEFAULT_CHASSIS_COLOR = "#59627a";
const STICKERS = [
  {id:"flame",emoji:"🔥",cost:6},{id:"bolt",emoji:"⚡",cost:6},{id:"skull",emoji:"💀",cost:8},
  {id:"star",emoji:"⭐",cost:5},{id:"crown",emoji:"👑",cost:10},{id:"robot",emoji:"🤖",cost:8},
  {id:"target",emoji:"🎯",cost:6},{id:"heart",emoji:"❤️",cost:5},{id:"fist",emoji:"👊",cost:6},
  {id:"gear",emoji:"⚙️",cost:5},{id:"alien",emoji:"👾",cost:8},{id:"trophy",emoji:"🏆",cost:10}];
function stickerOf(id){ return STICKERS.find(s=>s.id===id) || null; }
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
function floorsOf(chassis){ return INTERNAL_FLOORS[chassis] || 1; }
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
const EDIT_LAYERS = [
  { id:"chassis",  elev:1, slots:["propulsion"] },
  { id:"internal", elev:4, slots:["motor","battery","cpu","cooling","ballast","srimech"] },
  { id:"armor",    elev:7, slots:[] },
  { id:"external", elev:9, slots:["sensors","weapon1","weapon2"] },
];
const STICKER_LAYER = 4; // pseudo-layer: cosmetic decals, movable like parts
function isMounted(slot, id){ // unmounted weapon slots occupy NO space
  if(slot!=="weapon1" && slot!=="weapon2") return true;
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
function placedSlotsOf(build){ return [...EDIT_LAYERS[0].slots, ...instanceSlots(build), ...EDIT_LAYERS[3].slots]; }
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
  if(SLOT_LAYER[slot]===1) return fullyContained(chassis,pos,f) && noOverlap(pos,f,others); // internal
  return anchoredOnChassis(chassis,pos,f) && noOverlap(pos,f,others);                        // external
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
  const chassis=build.chassis||"boxy", eq=build.parts||{}, L={};
  const idOf=(slot)=> idAt(build, slot);
  // propulsion (one side): outer-left position where both mirrored sides mount
  { const f=footprintOf("propulsion",idOf("propulsion"));
    const row=Math.max(0, CHASSIS_SPEC[chassis].rear - f.d + 1);
    let col=Math.max(0, Math.round(gridCX(chassis)-f.w-2));
    for(let cc=0; cc+f.w<=gridCX(chassis); cc++){ const mc=mirrorCol(chassis,cc,f.w);
      if(anchoredOnChassis(chassis,{col:cc,row},f) && anchoredOnChassis(chassis,{col:mc,row},f)){ col=cc; break; } }
    L.propulsion={col,row}; }
  // internals: greedy pack, fully contained, spilling onto higher floors when full
  const floors=floorsOf(chassis); const byFloor=Array.from({length:floors},()=>[]);
  const bigFirst=instanceSlots(build).sort((a,b)=>{
    const fa=footprintOf(a,idOf(a)), fb=footprintOf(b,idOf(b));
    return fb.w*fb.d - fa.w*fa.d; });
  for(const slot of bigFirst){ const f=footprintOf(slot,idOf(slot));
    let done=false;
    for(let fl=0; fl<floors && !done; fl++){
      const pos=firstFit(chassis, f, byFloor[fl], "contain");
      if(pos){ L[slot]={...pos,floor:fl}; byFloor[fl].push({...pos,f}); done=true; }
    }
    if(!done) L[slot]={col:0,row:0,floor:0}; }
  // externals: anchored on the hull, may overhang
  const packedX=[];
  for(const slot of EDIT_LAYERS[3].slots){
    if(!isMounted(slot, idOf(slot))){ L[slot]={col:0,row:0}; continue; } // reserved = ghost, no space
    const f=footprintOf(slot,idOf(slot));
    const pos=firstFit(chassis, f, packedX, "anchor");
    if(pos){ L[slot]=pos; packedX.push({...pos,f}); } else L[slot]={col:0,row:0}; }
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
    const others=SLOTS.filter(o=>o!==slot && layerOf(o)===layerOf(slot)
        && isMounted(baseSlot(o), idFor(o))
        && (layout[o].floor||0)===(p.floor||0))
      .map(o=>({...layout[o], f:footprintOf(o, idFor(o))}));
    // temporarily evaluate with the equipped id of THIS slot
    const f=footprintOf(slot, idFor(slot));
    const li=layerOf(slot);
    const flOK = li!==1 || (p.floor||0) < floorsOf(build.chassis); // floor within range
    let geomOK, symOK=true;
    if(li===0){ // propulsion: left side left of axis, both mirrored sides mount
      symOK = p.col + f.w <= gridCX(build.chassis);
      geomOK = touchesChassis(build.chassis,p,f) && touchesChassis(build.chassis,{col:mirrorCol(build.chassis,p.col,f.w),row:p.row},f);
    } else if(li===1){ geomOK = fullyContained(build.chassis,p,f); }
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


const arenaImg=(typeof Image!=="undefined")?Object.assign(new Image(),{src:ARENA_SRC}):null;
function arenaReady(){ return !!(arenaImg && arenaImg.complete && arenaImg.naturalWidth>0); }


const _compImg = {};
function componentSprite(slot, id){ const t=COMPONENT_SPRITES[slot]; if(!t||!t[id]) return null;
  const k=slot+"/"+id; let im=_compImg[k];
  if(!im){ im=_compImg[k]=(typeof Image!=="undefined")?Object.assign(new Image(),{src:t[id].src}):null; }
  return im; }
function armorSprite(id){ const d=ARMOR_SPRITES[id]; if(!d) return null;
  const k="armor/"+id; let im=_compImg[k];
  if(!im){ im=_compImg[k]=(typeof Image!=="undefined")?Object.assign(new Image(),{src:d.src}):null; }
  return im; }
const PAINT_LO = 0.42, PAINT_HI = 0.72;   // L<LO → grime/rust kept, L>HI → paint (coloured)
const _spriteState = {};                   // chassis -> {def,img,layers,tint}
function spriteState(ch){ if(ch in _spriteState) return _spriteState[ch];
  const def=CHASSIS_SPRITES[ch];
  if(!def){ return _spriteState[ch]=null; }
  return _spriteState[ch]={ def, img:(typeof Image!=="undefined")?Object.assign(new Image(),{src:def.src}):null, layers:null, tint:{} }; }
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
function tintedChassis(ch, color){ const st=spriteState(ch); if(st.tint[color]) return st.tint[color];
  const L=chassisLayers(ch), img=st.img, w=img.naturalWidth, h=img.naturalHeight;
  const oc=document.createElement("canvas"); oc.width=w; oc.height=h; const o=oc.getContext("2d");
  o.fillStyle=color; o.fillRect(0,0,w,h);
  o.globalCompositeOperation="destination-in"; o.drawImage(L.paint,0,0);
  o.globalCompositeOperation="source-over"; o.drawImage(L.dirt,0,0);
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
  // propulsion: pave both mirrored side footprints (wheels/tracks — may protrude)
  { const id=eq.propulsion||ENGINE.PARTS.propulsion[0].id, f=footprintOf("propulsion",id);
    const p=layout.propulsion||{col:0,row:0};
    paveFoot(p.col, p.row, f, "propulsion"); paveFoot(mirrorCol(chassis,p.col,f.w), p.row, f, "propulsion"); }
  // externals (weapons/sensors) overhang the hull; internals are interior → not on the surface
  for(const slot of EDIT_LAYERS[3].slots){ const id=eq[slot]||ENGINE.PARTS[slot][0].id;
    if((slot==="weapon1"||slot==="weapon2") && ENGINE.PARTS[slot].findIndex(x=>x.id===id)===0) continue;
    const p=layout[slot]||{col:0,row:0}, f=footprintOf(slot,id);
    paveFoot(p.col, p.row, f, slot); }
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
  for(const slot of [...instanceSlots(build), ...EDIT_LAYERS[3].slots]){
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
  for(const slot of EDIT_LAYERS[3].slots){ const id=eq[slot]||ENGINE.PARTS[slot][0].id;
    if((slot==="weapon1"||slot==="weapon2") && ENGINE.PARTS[slot].findIndex(x=>x.id===id)===0) continue;
    cover((layout[slot]||{col:0,row:0}).col,(layout[slot]||{col:0,row:0}).row,footprintOf(slot,id)); }
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
      const bl=slotBox(chassis,bs,id,pos);
      const br=slotBox(chassis,bs,id,{col:mirrorCol(chassis,pos.col,f.w),row:pos.row});
      drawPartTile(c, bs, id, bl.cx, bl.cy, bl.wpx, bl.hpx, spin, alpha, opts.slip||0, false);
      drawPartTile(c, bs, id, br.cx, br.cy, br.wpx, br.hpx, spin, alpha, opts.slip||0, true);
      return;
    }
    drawPartTile(c, bs, id, b.cx-lift, b.cy-lift, b.wpx, b.hpx, spin, alpha, 0);
    if(floor>0){ c.save(); c.globalAlpha=alpha; c.fillStyle="rgba(255,255,255,.9)"; c.font="bold 9px system-ui";
      c.textAlign="right"; c.textBaseline="top"; c.fillText(String(floor+1), b.cx-lift+b.wpx/2-2, b.cy-lift-b.hpx/2+1); c.restore(); }
  };
  drawSlot("propulsion");                                                   // chassis level
  instanceSlots(build)                                                     // internals (expanded), low floor first
    .sort((a,b)=>(((layout[a]||{}).floor||0)-((layout[b]||{}).floor||0)))
    .forEach(drawSlot);
  drawArmorShell(c, chassis, eq.armor||"a0");                              // shell over internals
  EDIT_LAYERS[3].slots.forEach(drawSlot);                                  // externals on top
  const decals = build.stickers0 || [];                                    // placed decals (movable layer)
  if(decals.length){ const v=viewParams(chassis);
    c.save(); c.font=`${Math.round(v.cell*1.5)}px system-ui`; c.textAlign="center"; c.textBaseline="middle";
    const dim = (opts.focus!=null && opts.focus>=0 && opts.focus!==STICKER_LAYER);
    c.globalAlpha = dim ? 0.3 : 1;
    for(const d of decals){ const st=stickerOf(d.id); if(!st) continue;
      c.fillText(st.emoji, (d.col+0.5-v.ccol)*v.cell, (d.row+0.5-v.crow)*v.cell); }
    c.restore(); }
}
function drawEditor(canvas, build, layout, spin, focusLayer=-1, cgOn=false, hbOn=false){
  const c=canvas.getContext("2d"); const w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h); c.save(); c.translate(w/2,h/2);
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
      if(Math.abs(d.col-cell.col)<=0.5 && Math.abs(d.row-cell.row)<=0.5) return {sticker:i}; } }
  if(editFocus===STICKER_LAYER) return null;
  for(let li=EDIT_LAYERS.length-1; li>=0; li--){ if(editFocus>=0&&editFocus!==li) continue;
    for(const slot of EDIT_LAYERS[li].slots){ const p=layout[slot]; if(!p) continue;
      if(!isMounted(slot, curId(slot))) continue;
      const f=footprintOf(slot, curId(slot));
      const inRect=(col)=>cell.col>=col&&cell.col<col+f.w&&cell.row>=p.row&&cell.row<p.row+f.d;
      if(inRect(p.col)) return slot;
      if(li===0 && inRect(mirrorCol(build.chassis,p.col,f.w))) return slot; // right wheel selects the pair
    } }
  return null; }
function bindEditor(){ const cv=$("editorCv"); if(!cv||cv._bound) return; cv._bound=true;
  cv.addEventListener("pointerdown",(ev)=>{ const L=getLayout(); const pt=editorBoardPoint(cv,ev);
    const cell=pxToCell(AB().chassis,pt.x,pt.y); const hit=editorHit(L,cell); if(!hit) return;
    if(typeof hit==="object" && hit.sticker!=null){ editDrag={sticker:hit.sticker}; cv.setPointerCapture(ev.pointerId); return; }
    const slot=hit;
    editDrag={slot, dCol:cell.col-L[slot].col, dRow:cell.row-L[slot].row}; cv.setPointerCapture(ev.pointerId); });
  cv.addEventListener("pointermove",(ev)=>{ if(!editDrag) return; const L=getLayout();
    const pt=editorBoardPoint(cv,ev); const cell=pxToCell(AB().chassis,pt.x,pt.y);
    if(editDrag.sticker!=null){
      // stickers snap to HALF cells (so they can sit dead-centre on the axis);
      // dragging one off the hull removes it (pointerup handles the delete)
      const v=viewParams(AB().chassis);
      const colF=Math.round((pt.x/v.cell+v.ccol-0.5)*2)/2, rowF=Math.round((pt.y/v.cell+v.crow-0.5)*2)/2;
      const inside=cellInChassis("boxy",Math.round(colF),Math.round(rowF));
      const d=S.customize.placed[editDrag.sticker];
      d.col=colF; d.row=rowF; editDrag.off=!inside;
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
  const mk=(label,idx)=>{ const b=document.createElement("button"); b.className="ltab"+(editFocus===idx?" on":"");
    b.textContent=label; b.onclick=()=>{ editFocus=(editFocus===idx?-1:idx); renderLayerTabs(); }; el.appendChild(b); };
  mk(t("layAll"),-1); EDIT_LAYERS.forEach((L,i)=>mk(t("lay_"+L.id),i)); mk(t("layStickers"),STICKER_LAYER); }
function previewLoop(ts){ editSpin=(ts||0)/1000*3;
  if(typeof activeTab!=="undefined"){
    if(activeTab==="workshop"&&$("editorCv"))
      drawEditor($("editorCv"), {chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}, color:S.customize.color, stickers0:S.customize.placed}, getLayout(), editSpin, editFocus, showCG, showHB);
    if(activeTab==="fight"&&$("scoutCv")&&$("scoutCv")._oppBuild){
      const ob=$("scoutCv")._oppBuild; if(!ob.color)ob.color=opponentColor(nameSeed(ob.name||"")); drawEditor($("scoutCv"), ob, autoArrange(ob), editSpin, -1);
      if($("playerCv")&&$("playerCv")._build) drawEditor($("playerCv"), $("playerCv")._build, getLayout(), editSpin, -1);
    }
  }
  requestAnimationFrame(previewLoop);
}
requestAnimationFrame(previewLoop);

function renderWorkshop(){
  const rows = $("slotRows"); rows.innerHTML = "";
  for (const slot of SLOT_ORDER){
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
      cur.innerHTML = `${t("pn_"+eqId)}<span class="pfx">${partFx(slot, part)}</span>`;
      row.appendChild(cur);
      const owned = S.parts.owned[slot];
      if (owned.length > 1){
        const sel = document.createElement("select");
        const ordered = owned.slice().sort((a,b)=>            // ascending capacity (PARTS order)
          ENGINE.PARTS[slot].findIndex(p=>p.id===a) - ENGINE.PARTS[slot].findIndex(p=>p.id===b));
        for (const id of ordered){
          const o = document.createElement("option");
          o.value = id; o.textContent = t("pn_"+id);
          if (id === eqId) o.selected = true;
          sel.appendChild(o);
        }
        sel.onchange = ()=>{
          const prev = S.parts.equipped[slot];
          S.parts.equipped[slot] = normEquip(slot, sel.value);
          // packing guard: the new part must actually FIT the hull (with everything
          // else re-arranged). If not, revert — free up space or wait for a bigger chassis.
          const build = {chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}};
          const L = autoArrange(build);
          if (!layoutValid(build, L)){
            S.parts.equipped[slot] = prev; sel.value = prev ?? EMPTY_ID[slot];
            showToast(t("noRoom"));
            return;
          }
          AB().layout = L; recomputeOwned(); saveState(); renderHome(); };
        row.appendChild(sel);
      } else {
        const hint = document.createElement("button"); hint.className = "ghosthint";
        hint.textContent = t("notOwned");
        hint.onclick = ()=> showTab("shop");
        row.appendChild(hint);
      }
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


// stack N copies of a slot's part: uses a free copy from stock, else buys one — then footprint-gated.
function setCount(slot, delta){
  const b=AB(); const cur=b.counts[slot]||1, next=Math.max(1, cur+delta);
  if(next===cur) return;
  const id=b.equipped[slot];
  let buyCost=0;
  if(delta>0){
    const spare = invCount(id) - installedElsewhere(id) - cur;   // free copies beyond the current stack
    if(spare < 1){                                               // none free → must buy another copy
      buyCost = (ENGINE.partOf(slot,id)||{}).cost||0;
      if(S.bolts < buyCost){ showToast(t("noBolts")); return; }
    }
  }
  const prev=b.counts[slot]; b.counts[slot]=next;
  const build={chassis:b.chassis, parts:{...b.equipped}, counts:{...b.counts}};
  const L=autoArrange(build);
  if(!layoutValid(build, L)){ if(prev==null) delete b.counts[slot]; else b.counts[slot]=prev; showToast(t("noRoom")); return; }
  if(buyCost){ S.bolts -= buyCost; S.inventory[id]=(S.inventory[id]||0)+1; }  // commit the purchase (it fits)
  b.layout=L; recomputeOwned(); saveState(); renderHome();
}
// equip only if the new part actually fits the hull (auto-arranged); else revert.
function tryEquip(type, id){
  const prev = S.parts.equipped[type];
  S.parts.equipped[type] = normEquip(type, id);
  const build = {chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}};
  const L = autoArrange(build);
  if(!layoutValid(build, L)){ S.parts.equipped[type] = prev; return false; }
  AB().layout = L; recomputeOwned(); return true;
}
function mkPartCard(type, part, reserved){
  const card = document.createElement("div"); card.className = "gcard";
  const cv = document.createElement("canvas"); cv.width = cv.height = 54; cv.className = "gtile";
  drawPartTile(cv.getContext("2d"), type, part.id, 27, 27, 40, 30, 0, 1);
  card.appendChild(cv);
  const nm = document.createElement("div"); nm.className = "gcname"; nm.textContent = t("pn_"+part.id);
  card.appendChild(nm);
  const fx = document.createElement("div"); fx.className = "gcfx";
  fx.textContent = reserved
    ? ((type==="weapon1"||type==="weapon2") ? t("noneAvail") : t("stock"))
    : partFx(type, part);
  card.appendChild(fx);
  if (reserved) return card;
  const total = invCount(part.id), elsewhere = installedElsewhere(part.id);
  if (total > 0){
    const al = document.createElement("div"); al.className = "gcalloc";
    al.textContent = "\u00D7"+total + (elsewhere>0 ? " \u00B7 "+t("onOtherBot",{n:elsewhere}) : "");
    if (elsewhere>0 && elsewhere>=total) al.classList.add("spoken"); // all copies busy elsewhere
    card.appendChild(al);
  }
  const owned = S.parts.owned[type].includes(part.id);
  const equipped = S.parts.equipped[type] === part.id;
  const btn = document.createElement("button"); btn.className = "gbuy";
  if (equipped){ btn.textContent = t("equipped"); btn.disabled = true; btn.classList.add("maxed"); }
  else if (owned){ btn.textContent = t("equip");
    btn.onclick = ()=>{ if(tryEquip(type, part.id)){ saveState(); renderHome(); } else showToast(t("noRoom")); }; }
  else { btn.textContent = part.cost + " \uD83D\uDD29"; btn.disabled = S.bolts < part.cost;
    btn.onclick = ()=>{ if (S.bolts < part.cost) return; S.bolts -= part.cost;
      S.inventory[part.id]=(S.inventory[part.id]||0)+1; recomputeOwned();
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
  const bot = defaultBot(chassis);
  for(const sl in bot.equipped){ const id=bot.equipped[sl]; if(id) S.inventory[id]=(S.inventory[id]||0)+1; } // grant its stock parts
  S.garage.push(bot); S.activeBot = S.garage.length-1;
  syncActive(); recomputeOwned(); saveState();
  showToast(t("botBought",{name:info.name})); renderHome(); }
function drawBotThumb(ctx, chassis, color){ ctx.clearRect(0,0,64,64);
  if(chassisSpriteReady(chassis)){
    const img = color ? tintedChassis(chassis,color) : spriteState(chassis).img;
    const s=Math.min(58/img.width,58/img.height);
    if(!color) ctx.globalAlpha=0.85;
    ctx.drawImage(img, 32-img.width*s/2, 32-img.height*s/2, img.width*s, img.height*s); ctx.globalAlpha=1;
  } else { ctx.fillStyle=color||"#3a4152"; rr(ctx,10,10,44,44,6); ctx.fill(); }
}
function renderGarageStrip(){ const el=$("garageStrip"); if(!el) return; el.innerHTML="";
  const head=document.createElement("div"); head.className="persohead"; head.textContent=t("garageTitle"); el.appendChild(head);
  const strip=document.createElement("div"); strip.className="botstrip";
  S.garage.forEach((bot,i)=>{ const card=document.createElement("div"); card.className="botcell"+(i===S.activeBot?" active":"");
    const cv=document.createElement("canvas"); cv.width=cv.height=64; cv.className="botthumb";
    drawBotThumb(cv.getContext("2d"), bot.chassis, bot.customize.color); card.appendChild(cv);
    const nm=document.createElement("div"); nm.className="botname"; nm.textContent=chassisName(bot.chassis); card.appendChild(nm);
    card.onclick=()=>setActiveBot(i); strip.appendChild(card); });
  for(const ch of BUYABLE_CHASSIS){ const info=CHASSIS_INFO[ch];
    const card=document.createElement("div"); card.className="botcell buy"+(S.bolts<info.cost?" cant":"");
    const cv=document.createElement("canvas"); cv.width=cv.height=64; cv.className="botthumb";
    drawBotThumb(cv.getContext("2d"), ch, null); card.appendChild(cv);
    const nm=document.createElement("div"); nm.className="botname"; nm.textContent=info.name; card.appendChild(nm);
    const pr=document.createElement("div"); pr.className="botprice"; pr.textContent=info.cost+" \uD83D\uDD29"; card.appendChild(pr);
    card.onclick=()=>buyBot(ch); strip.appendChild(card); }
  el.appendChild(strip); }
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
// tournament catalogue (format-extensible; ladder wired now, league/bracket to follow)
/* B2 — une épreuve = deux axes (palier, classe) + un format + des règles, tout en
   données. NOTE chantier D : pas de plafond de masse automatique au palier tant que
   l'économie n'est pas recalée (le bot de départ pèse 1,38 kg > 1,36 officiel). */
const TOURNAMENTS = [
  { id:"sumoM", name:"Sumo Classe M", format:"ladder", levels:5,
    rules:{ tier:"beetle", chassisClass:"M", banWeapons:true, mode:"sumo",
            maxCount:{ motor:3, battery:3 } } },
  { id:"lightM", name:"Sumo Léger", format:"league", rounds:10,
    rules:{ tier:"beetle", chassisClass:"M", banWeapons:true, banTracks:true, mode:"sumo",
            metrics:{ weightKg:2.0 }, maxCount:{ motor:1, battery:1, cooling:1, ballast:1 } } },
  { id:"cupM", name:"Coupe M", format:"bracket", size:16,
    rules:{ tier:"beetle", chassisClass:"M", banWeapons:true, mode:"sumo",
            maxCount:{ motor:3, battery:3 } } },
];
// format engines: encapsulate a competition's state transitions (ladder wired; league/bracket to follow)
const FORMATS = {
  ladder: {
    // advance ladder state on a tournament match result; returns a UI descriptor (no DOM here)
    tourResult(realWin, w){
      if(realWin){
        if(S.tourney.idx < 2){ S.tourney.idx++; return {kind:"next", i:S.tourney.idx+1}; }
        const prize = w*5; S.bolts += prize;
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
  league: {
    RIVALS: ["MAXIMUS","VORTEX","BRUTUS","NOVA","TITAN","RAZOR","CINDER","JOLT"],
    _rng(seed){ let a=(seed>>>0)||1; return ()=>{ a=(a*1664525+1013904223)>>>0; return a/4294967296; }; },
    init(seed, rounds){ const rng=this._rng(seed);
      const rivals=this.RIVALS.slice(0,5).map(n=>({name:n, strength:0.35+rng()*0.5, score:0}));
      return { format:"league", round:0, rounds:rounds||10, myScore:0, rivals }; },
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
const FORMAT_LABEL = { ladder:"Ladder \u00B7 5 niveaux", league:"Ligue \u00B7 10 manches", bracket:"Coupe \u00B7 arbre 16" };
function enterBracket(){
  if(S.bracket){ startMatch("bracket"); return; }                    // resume
  const myBuild={chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}};
  const chk=checkEntry(myBuild, TOURNAMENTS.find(x=>x.id==="cupM").rules);
  if(!chk.ok){ showToast(chk.fails[0]); return; }
  const bk=FORMATS.bracket.init(Math.floor(Math.random()*1e9));
  bk.lock = { chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}, color:S.customize.color,
    stickers:[...S.customize.placed], layout: autoArrange(myBuild) };   // build frozen at entry
  S.bracket=bk; saveState(); startMatch("bracket");
}
function enterLeague(){
  if(S.league){ startMatch("league"); return; }                       // resume an ongoing season
  const myBuild={chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}};
  const chk=checkEntry(myBuild, TOURNAMENTS.find(x=>x.id==="lightM").rules);
  if(!chk.ok){ showToast(chk.fails[0]); return; }
  S.league = FORMATS.league.init(Math.floor(Math.random()*1e9)); saveState(); startMatch("league");
}
function renderBracketView(){ const el=$("bracketView"); if(!el) return;
  if(!S.bracket){ el.style.display="none"; el.innerHTML=""; return; }
  const bk=S.bracket; el.style.display="block"; el.innerHTML="";
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
function renderLeagueStandings(){ const el=$("leagueStandings"); if(!el) return;
  if(!S.league){ el.style.display="none"; el.innerHTML=""; return; }
  el.style.display="block"; el.innerHTML="";
  const head=document.createElement("div"); head.className="persohead";
  head.textContent=t("leagueTable")+" \u00B7 "+t("leagueRound",{r:Math.min(S.league.round+1,S.league.rounds), n:S.league.rounds, rank:FORMATS.league.myRank(S.league)});
  el.appendChild(head);
  const tbl=document.createElement("table"); tbl.className="lgtable";
  for(const e of FORMATS.league.standings(S.league)){
    const tr=document.createElement("tr"); tr.className=(e.me?"me ":"")+(e.rank<=3?"podium":"");
    tr.innerHTML=`<td class="rk">${e.rank}</td><td>${e.me?t("you"):e.name}</td><td class="sc">${e.score} · ${e.avg.toFixed(2)}</td>`;
    tbl.appendChild(tr);
  }
  el.appendChild(tbl); }
function renderTournaments(){ const el=$("tournaments"); if(!el) return; el.innerHTML="";
  const head=document.createElement("div"); head.className="persohead"; head.textContent=t("tournaments"); el.appendChild(head);
  const strip=document.createElement("div"); strip.className="tvstrip";
  const myBuild={chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}};
  for(const tr of TOURNAMENTS){ const live = tr.format==="ladder" || tr.format==="league" || tr.format==="bracket";
    const card=document.createElement("div"); card.className="tvcard"+(live?" active":" soon");
    const nm=document.createElement("div"); nm.className="tvname"; nm.textContent=tr.name; card.appendChild(nm);
    const fm=document.createElement("div"); fm.className="tvfmt"; fm.textContent=FORMAT_LABEL[tr.format]||tr.format; card.appendChild(fm);
    const ru=document.createElement("div"); ru.className="tvrules"; ru.textContent=rulesSummary(tr.rules); card.appendChild(ru);
    const chk=checkEntry(myBuild, tr.rules);
    const eg=document.createElement("div"); eg.className="tvelig "+(chk.ok?"ok":"no");
    eg.textContent = chk.ok ? "\u2713 "+t("scrPass") : "\u2717 "+chk.fails[0];
    card.appendChild(eg);
    if(tr.format==="bracket"){ card.onclick=()=>enterBracket();
      if(S.bracket){ const sv=document.createElement("div"); sv.className="tvelig ok"; sv.textContent=FORMATS.bracket.roundName(S.bracket); card.appendChild(sv); } }
    if(tr.format==="league"){ card.onclick=()=>enterLeague();
      if(S.league){ const sv=document.createElement("div"); sv.className="tvelig ok"; sv.textContent=t("leagueRound",{r:S.league.round+1,n:S.league.rounds,rank:FORMATS.league.myRank(S.league)}); card.appendChild(sv); } }
    if(!live){ const sn=document.createElement("div"); sn.className="tvrules"; sn.style.marginTop="4px"; sn.textContent=t("soon"); card.appendChild(sn); }
    strip.appendChild(card); }
  el.appendChild(strip); }
function renderGarage(){
  const g = $("garageRows"); g.innerHTML = "";
  const TYPES = SLOT_ORDER.filter(x=>x!=="chassis").map(x=>[x,"slot_"+x]);
  for (const [type, header] of TYPES){
    const h = document.createElement("div"); h.className = "gsec";
    h.textContent = t(header);
    g.appendChild(h);
    const strip = document.createElement("div"); strip.className = "gcarousel";
    g.appendChild(strip);
    if (ENGINE.PARTS[type].length === 1){
      strip.appendChild(mkPartCard(type, ENGINE.PARTS[type][0], true));
      continue;
    }
    for (const part of ENGINE.PARTS[type]) strip.appendChild(mkPartCard(type, part, false));
  }
  // stickers: cheap cosmetics, bought here, placed in the workshop
  const h = document.createElement("div"); h.className = "gsec"; h.textContent = t("persoSticker");
  g.appendChild(h);
  const strip = document.createElement("div"); strip.className = "gcarousel";
  g.appendChild(strip);
  for (const st of STICKERS){
    const owned = S.customize.stickers.includes(st.id);
    const card = document.createElement("div"); card.className = "gcard stickercard"+(owned?" owned":"");
    card.innerHTML = `<div class="semoji">${st.emoji}</div>`+
      (owned ? `<div class="sprice">${t("stickerOwned")}</div>` : "");
    if (!owned){
      const btn = document.createElement("button"); btn.className="gbuy";
      btn.textContent = `${st.cost} 🔩`;                     // same style as part cards
      btn.disabled = S.bolts < st.cost;
      btn.onclick = ()=>{ if (S.bolts < st.cost) return; S.bolts -= st.cost;
        S.customize.stickers.push(st.id); saveState();
        showToast(t("bought", {name:st.emoji})); renderHome(); };
      card.appendChild(btn);
    }
    strip.appendChild(card);
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
  const dpr = window.devicePixelRatio || 1;
  const w = Math.min(cv.parentElement.clientWidth || 420, 520);
  cv.width = w*dpr; cv.height = w*dpr;
  cv.style.height = w+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

let curMode = "qual"; // "qual" | "tour" | "exhib" | "league"
let exhibOpp = null, leagueOpp = null, bracketOpp = null;

function startMatch(mode){
  curMode = mode || (tournamentOpen() ? "tour" : "qual");
  let enemy;
  if (curMode === "tour"){ ensureTourney(); enemy = S.tourney.opponents[S.tourney.idx]; }
  else if (curMode === "exhib"){
    const g = ENGINE.genOpponent(Math.floor(Math.random()*1e9), S.level);
    exhibOpp = { name:pickName(), archetype:g.archetype, build:g.build, level:S.level };
    enemy = exhibOpp;
  }
  else if (curMode === "league"){
    const g = ENGINE.genOpponent(Math.floor(Math.random()*1e9), S.level);
    leagueOpp = { name: FORMATS.league.RIVALS[S.league.round % 5], archetype:g.archetype, build:g.build, level:S.level };
    enemy = leagueOpp;
  }
  else if (curMode === "bracket"){
    const opp = FORMATS.bracket.myOpponent(S.bracket);
    const g = ENGINE.genOpponent((S.bracket.seed ^ (S.bracket.round*7))>>>0, S.level);
    bracketOpp = { name: opp.name, archetype:g.archetype, build:g.build, level:S.level };
    enemy = bracketOpp;
  }
  else { ensureOpponent(); enemy = S.opponent; }

  const seed = Math.floor(Math.random()*1e9);
  // bracket: the build is LOCKED at entry — only pilot params (S.settings) change between bouts.
  const lock = (curMode==="bracket" && S.bracket) ? S.bracket.lock : null;
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
  enemy.build.colliders = buildColliders(enemy.build, autoArrange(enemy.build));
  match = ENGINE.makeMatch(seed, playerBuild, enemy.build);
  particles=[]; trails=[[],[]]; flashes=[0,0]; slowmoT=0; shake=0; acc=0; lastTs=0; wasForfeit=false; odom=[0,0]; floaties=[]; wheelPhase=[0,0]; slipR=[0,0]; flipAnim=[0,0]; domShown=[false,false];
  NAV.push("matchScreen");
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
  if(arenaReady()){                                   // arena sprite as the static floor
    ctx.save(); ctx.beginPath(); ctx.arc(0,0,AR+6,0,7); ctx.clip();
    ctx.drawImage(arenaImg, -(AR+8), -(AR+8), (AR+8)*2, (AR+8)*2); ctx.restore();
  } else {
    ctx.beginPath(); ctx.arc(0,0,AR+8,0,7); ctx.fillStyle="#171a22"; ctx.fill();
    ctx.beginPath(); ctx.arc(0,0,AR,0,7); ctx.fillStyle="#20242f"; ctx.fill();
  }
  // sudden-death: darken the shrinking-out zone + draw the live ring at match.arenaR
  if(match.arenaR < AR-1){
    ctx.save(); ctx.beginPath(); ctx.arc(0,0,AR+8,0,7); ctx.arc(0,0,match.arenaR,0,7,true);
    ctx.fillStyle="rgba(8,9,12,.62)"; ctx.fill("evenodd"); ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0,0,match.arenaR,0,7);
  ctx.lineWidth=3; ctx.strokeStyle = match.t>ENGINE.SUDDEN_DEATH_T ? "#ff5252" : "#d9a441"; ctx.stroke();

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
    ctx.save();
    ctx.translate(bot.pos.x, bot.pos.y); ctx.rotate(bot.angle);
    const r = bot.radius;
    // WYSIWYG: the live bot is the SAME editor visual — chassis + placed tiles.
    // editor "front" is up (−y); the bot faces +x, so add π/2 to align.
    ctx.save();
    ctx.rotate(Math.PI/2);
    const vis = colliderVis(bot.build.chassis);   // cell-true: same px per cell for every hull
    ctx.scale(vis, vis);
    // FLIP is a visible event: a fast tumble (squash through the axis) at the
    // moment it happens, then a belly-up pose (darkened, wheels showing, wobble)
    // for as long as the bot is on its back.
    const fa = flipAnim[bot.id]||0;
    if (fa > 0){ const k = Math.cos((1-fa)*Math.PI); ctx.scale(1, Math.max(0.08, Math.abs(k))); }
    const flipped = bot.flippedT > 0;
    if (flipped){ ctx.rotate(Math.sin(match.t*9 + bot.id)*0.06); ctx.scale(1,-1); }
    const layout = bot.id===0 ? getLayout() : autoArrange(bot.build);
    drawBotTiles(ctx, bot.build, layout, wheelPhase[bot.id], {shadow:true, slip:slipR[bot.id], bellyUp:flipped});
    ctx.restore();
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
              [t("dbFlipped"),m.bots[0].flippedT.toFixed(1)+" s",m.bots[1].flippedT.toFixed(1)+" s"]];
  const head=document.createElement("div"); head.className="dbhead";
  head.textContent=t("dbTitle")+" — "+m.t.toFixed(0)+" s · "+(endKey?t(endKey):(m.reason||""));
  el.appendChild(head);
  const tab=document.createElement("table"); tab.className="dbtab";
  const tr0=document.createElement("tr");
  for(const h of ["",t("you"),($("oppName")&&$("oppName").textContent)||"—"]){
    const th=document.createElement("th"); th.textContent=h; tr0.appendChild(th); }
  tab.appendChild(tr0);
  for(const [l,a,b] of rows){ const tr=document.createElement("tr");
    for(const v of [l,a,b]){ const td=document.createElement("td"); td.textContent=v; tr.appendChild(td); }
    tab.appendChild(tr); }
  el.appendChild(tab);
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
  else if (won) earned = (curMode==="tour"||curMode==="league"||curMode==="bracket") ? Math.ceil(w*0.5) : w;
  else earned = Math.ceil(w*0.25); // tournament losses pay too: the penalty is the restart, not poverty
  S.bolts += earned;
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
    const done = FORMATS.bracket.recordMatch(S.bracket, realWin);    // win → advance, loss → eliminated
    if (!done){
      $("ovMain").textContent = t("bracketNext", {r: FORMATS.bracket.roundName(S.bracket)});
    } else {
      const pr = FORMATS.bracket.prize(S.bracket, w);
      S.bolts += pr.total;
      $("ovTitle").textContent = (pr.champ ? t("bracketChamp") : t("bracketOut")) + " 🏆";
      $("ovTitle").style.color = "var(--accent)";
      unlockEl.textContent = t("bracketPrize", {total:pr.total}); unlockEl.style.display = "block";
      S.bracket = null;
      $("ovMain").textContent = t("nextOpp");
    }
  } else if (curMode === "league"){
    const done = FORMATS.league.recordMatch(S.league, m.duels[0]);   // your duels this bout (0..2)
    const rank = FORMATS.league.myRank(S.league);
    if (!done){
      $("ovMain").textContent = t("leagueRound", {r:S.league.round+1, n:S.league.rounds, rank});
    } else {
      const pr = FORMATS.league.prize(S.league, w);
      S.bolts += pr.total;
      $("ovTitle").textContent = t("leagueDone")+" 🏁"; $("ovTitle").style.color = "var(--accent)";
      unlockEl.textContent = t("leaguePrize", {rank:pr.rank, total:pr.total}); unlockEl.style.display = "block";
      S.league = null;
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
  show(id){
    for (const sc of ["homeScreen","matchScreen"]) $(sc).style.display = (sc===id) ? "block" : "none";
    $("navBack").style.display = (this.stack.length>1 && id!=="matchScreen") ? "" : "none";
  },
  push(id){ this.stack.push(id); this.show(id);
    try{ history.pushState({nav:this.stack.length}, ""); }catch(e){} },
  back(){ if (this.stack.length<=1) return; this.stack.pop();
    this.show(this.stack[this.stack.length-1]); renderHome(); },
};
try{ window.addEventListener("popstate", ()=>NAV.back()); }catch(e){}
$("navBack").onclick = ()=>NAV.back();
let activeTab = "workshop"; // B1 : on démarre au Garage — préparer, puis combattre
function showTab(name){
  activeTab = name;
  for (const [k,id] of Object.entries(TABS))
    $(id).style.display = (k===name) ? "block" : "none";
  $("tabFight").classList.toggle("active", name==="fight");
  $("tabWorkshop").classList.toggle("active", name==="workshop");
  $("tabShop").classList.toggle("active", name==="shop");
}
$("tabFight").onclick = ()=> showTab("fight");
$("tabWorkshop").onclick = ()=> showTab("workshop");
$("tabShop").onclick = ()=> showTab("shop");
$("resetLayout").onclick = ()=>{ autoArrangeCurrent(); renderLayerTabs(); };
$("cgToggle").onclick = ()=>{ showCG=!showCG; $("cgToggle").classList.toggle("on",showCG); $("cgToggle").textContent=t(showCG?"cgHide":"cgShow"); };
$("hbToggle").onclick = ()=>{ showHB=!showHB; $("hbToggle").classList.toggle("on",showHB); $("hbToggle").textContent=t(showHB?"hbHide":"hbShow"); };

$("fightBtn").onclick = ()=> startMatch(S.bracket ? "bracket" : S.league ? "league" : (tournamentOpen() ? "tour" : "qual"));
$("friendlyBtn").onclick = ()=> startMatch("exhib");
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
  const goHome = ()=>NAV.back();
  if (realWin) goHome();                    // scout the next opponent / bracket match
  else if (curMode === "exhib") goHome();   // lost friendly: no forced rematch loop
  else if (curMode === "league") goHome();  // league plays all 10 bouts, win or lose
  else if (curMode === "bracket") goHome(); // bracket: win→next round, loss→eliminated
  else startMatch(curMode);                 // retry (tournament restarts at match 1)
};
$("ovBack").onclick = ()=>{ $("overlay").style.display="none"; NAV.back(); };
$("langBtn").onclick = ()=>{ LANG = LANG==="fr"?"en":"fr"; S.lang = LANG; saveState(); renderHome(); };
window.addEventListener("resize", ()=>{ if (match && !match.over) setupCanvas(); });

renderHome();
showTab(activeTab);
