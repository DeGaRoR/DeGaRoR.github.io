/* tools/econ_sim.js — simulateur de progression économique.
   Charge les VRAIES données (data.js + engine.js) : les prix viennent du jeu,
   jamais de copies. Modélise un joueur : boucle concours/libre, achat glouton
   du meilleur upgrade abordable, winrate couplé au matériel, réserve
   réparations. Sortie : jalons en HEURES par scénario.
   Unité : euros (parité 1:1 avec l'unité actuelle, décision 22/07). */
const fs = require("fs"), path = require("path");
const P = (f)=>path.join(__dirname, "..", f);
const ctx = { window:undefined, console };
require("vm").createContext(ctx);
const src = fs.readFileSync(P("data.js"),"utf8") + "\n" + fs.readFileSync(P("engine.js"),"utf8")
  + "\nthis.ENGINE=ENGINE; this.CHASSIS_INFO=CHASSIS_INFO; this.WIN_EUR=WIN_EUR; this.LIGUES_DATA=LIGUES; this.TOURNAMENTS_DATA=TOURNAMENTS;";
require("vm").runInContext(src, ctx, {filename:"data+engine"});
const { ENGINE, CHASSIS_INFO, WIN_EUR, LIGUES_DATA, TOURNAMENTS_DATA } = ctx;
const WIN_BOLTS = WIN_EUR;                                   // E1 : source unique = data.js

/* ── univers d'achat (depuis les données réelles) ── */
const SLOT_TIERS = {};   // slot → [defs triés par coût]
let CATALOG = [];        // {slot,id,cost,tier}
for (const slot in ENGINE.PARTS){
  const xs = ENGINE.PARTS[slot].filter(p=>p.cost>0).sort((a,b)=>a.cost-b.cost);
  if (!xs.length) continue;
  SLOT_TIERS[slot] = xs.map(p=>p.id);
  xs.forEach((p,i)=>CATALOG.push({slot, id:p.id, cost:p.cost, tier:i+1}));
}
const CHASSIS = Object.entries(CHASSIS_INFO).filter(([,v])=>v.cost>0)
  .map(([id,v])=>({slot:"chassis", id, cost:v.cost, tier:1}));
const STACKABLE = ["motor","battery","cooling","ballast"];
const STACKS = [];       // 2 exemplaires additionnels du meilleur def de chaque slot empilable
for (const slot of STACKABLE){
  const best = ENGINE.PARTS[slot].filter(p=>p.cost>0).sort((a,b)=>b.cost-a.cost)[0];
  if (best) for (let k=0;k<2;k++) STACKS.push({slot:slot+"_stack"+k, id:best.id, cost:best.cost, tier:3});
}
const UNIVERSE = [...CATALOG, ...CHASSIS, ...STACKS];
const TOTAL_COST = UNIVERSE.reduce((a,x)=>a+x.cost,0);

/* ── contenu cible : 3 ligues × 6 concours (18) ; bourses ×mult de ligue ──
   Formats et primes = formules RÉELLES du jeu (app.js) :
   ladder: 5 étages, prime 5w ; champ: 10 manches, part 1.5w + podium 4w/2w/w ;
   coupe: 4 tours, cumul [w,2w,3w,5w,8w]. Manche gagnée w/2, perdue w/4. */
const LEAGUES = [
  { name:"Regionale",      mult:1,  oppPen:0.00, concours:["ladder","champ","cup","ladder","champ","cup"] },
  { name:"Nationale",      mult:4,  oppPen:0.08, concours:["ladder","champ","cup","ladder","champ","cup"] },
  { name:"Internationale", mult:15, oppPen:0.15, concours:["champ","cup","champ","cup","ladder","cup"] },
];
const FIGHT_MIN = 1.4;             // minutes par combat, navigation comprise
const REPAIR_RESERVE = 0.25;       // part de revenu réservée au futur chantier C

function gearScore(owned){         // 0..1 : tiers moyens + logiciel
  let s=0, n=0;
  for (const slot in SLOT_TIERS){
    const tiers = SLOT_TIERS[slot];
    let best=0; tiers.forEach((id,i)=>{ if(owned.has(slot+":"+id)) best=i+1; });
    s += best/tiers.length; n++;
  }
  return s/n;
}
function simulate(opts){
  const { fixedWinrate=null, contentMult=1, wTable=WIN_BOLTS, priceMult=1, label,
          leagueMults=null, winGate=0 } = opts;
  let euros=0, level=1, spentTot=0, minutes=0;
  const owned=new Set(), milestones={};
  const buyable = UNIVERSE.map(x=>({...x, cost:Math.round(x.cost*priceMult)}))
                          .sort((a,b)=>a.cost-b.cost);
  const w=()=>wTable[Math.min(level,wTable.length-1)];
  const p=(lg)=>{ if(fixedWinrate) return Math.max(.15, fixedWinrate - lg.oppPen);
    return Math.min(.75, Math.max(.20, .35 + .38*gearScore(owned) - lg.oppPen)); };
  const earn=(e)=>{ euros += e*(1-REPAIR_RESERVE); };
  const buy=()=>{ for(const it of buyable){ const k=it.slot+":"+it.id;
      if(owned.has(k)) continue;
      if(euros>=it.cost){ euros-=it.cost; spentTot+=it.cost; owned.add(k);
        if(!milestones.firstUpgrade) milestones.firstUpgrade=minutes;
      } else break; } };
  const fight=(pr, winPay, losePay)=>{ minutes+=FIGHT_MIN;
    const win=Math.random()<pr; earn(win?winPay:losePay); return win; };

  const rng=()=>Math.random;
  let seed=42; Math.random=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/2**32; };

  let li=0, beaten=0;
  for (const lg of LEAGUES){
    const lmult = leagueMults ? leagueMults[li++] : lg.mult;
    for (const kind of lg.concours){
      // porte de victoires : le concours exige un palmarès — grind libre sinon
      let guardG=0;
      while (winGate>0 && beaten < winGate && guardG++<600){
        if (fight(p(lg), w(), Math.ceil(w()/4))) beaten++;
        buy(); }
      if (winGate>0) beaten -= winGate;                      // le palmarès se "dépense" par concours
      const W=w(), pr=p(lg), M=lmult*contentMult;
      if (kind==="ladder"){
        let stage=0, guard=0;
        while(stage<5 && guard++<400){ if(fight(pr, W/2*M, W/4*M)) stage++; else stage=Math.max(0,stage-1); buy(); }
        earn(W*5*M); if(level<5) level++;
      } else if (kind==="champ"){
        let wins=0;
        for(let m=0;m<10;m++){ if(fight(pr, W/2*M, W/4*M)) wins++; buy(); }
        earn(Math.ceil(wins*1.5)*M + (wins>=8?W*4:wins>=6?W*2:wins>=5?W:0)*M);
      } else { // cup : 4 tours, élimination
        let r=0;
        while(r<4){ if(fight(pr, W/2*M, W/4*M)){ r++; } else break; buy(); }
        earn([0, W, W*2, W*3, W*8][r]*M);
      }
      buy();
      const pct=[...owned].length/UNIVERSE.length;
      for (const [th,name] of [[.25,"own25"],[.5,"own50"],[.75,"own75"],[1,"own100"]])
        if(pct>=th && !milestones[name]) milestones[name]=minutes;
      if(!milestones[lg.name] ) milestones[lg.name+"_start"]=milestones[lg.name+"_start"]??minutes;
    }
    milestones[lg.name+"_done"]=minutes;
    // entre les ligues : grind libre jusqu'à pouvoir suivre (matos < 40% → 30 combats libres)
    let guard=0;
    while(gearScore(owned)<0.4+0.2*LEAGUES.indexOf(lg) && guard++<200){
      fight(p(lg), w(), Math.ceil(w()/4)); buy(); }
  }
  Math.random=rng();
  const H=(m)=>m==null?"  —  ":(m/60).toFixed(1)+"h";
  return { label, level, milestones, totalMin:minutes, hours:(minutes/60).toFixed(1),
    ownedPct:Math.round(100*[...owned].length/UNIVERSE.length),
    spent:spentTot, left:Math.round(euros),
    line: [label.padEnd(34), H(milestones.firstUpgrade), H(milestones.own50), H(milestones.own100),
           H(milestones.Regionale_done), H(milestones.Nationale_done), H(milestones.Internationale_done),
           (minutes/60).toFixed(1)+"h", Math.round(100*[...owned].length/UNIVERSE.length)+"%"].join(" | ") };
}

/* ══ Campagne 2 — progression LONG TERME : arc d'intro S → pont bot M
   d'occasion → arc M complet (scénario D). Les prix S = catalogue M × 0.22
   (antweight réel ≈ 1/5 du beetleweight) ; S plafonné software v2. ══ */
function simulateLongTerm(opts){
  const { label, sStartBudget=40, wS=[0,5,8], sGates=4,
          usedBotPrice=240, usedBotGear=0.35,
          wM=[0,12,20,32,50,80], mGate=12, mMults=[1,2.5,6] } = opts;
  let euros=sStartBudget, minutes=0, log={};
  let seed=1337; const _r=Math.random; Math.random=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/2**32; };
  const fight=(p,win,lose)=>{ minutes+=FIGHT_MIN; const w=Math.random()<p; euros+=(w?win:lose)*(1-REPAIR_RESERVE); return w; };
  /* — Phase S : petit matos, winrate qui monte vite (upgrades à 10-40 €) — */
  let sGear=0.15;
  const sEvents=[["ladder",3],["cup",3],["ladder",4]];       // Initiation, Coupe des Puces, Finale S
  for (const [kind,len] of sEvents){
    let g=0; while(g<sGates){ if(fight(.35+.5*sGear, wS[1], 1)) g++;   // libre S : porte de palmarès
      if(euros>=14){euros-=14; sGear=Math.min(1,sGear+.09);} }         // upgrade S ~14 € moyen
    if (kind==="ladder"){ let st=0,gd=0;
      while(st<len&&gd++<200){ if(fight(.35+.5*sGear, wS[1]/2, 1)) st++; else st=Math.max(0,st-1); }
      euros+=wS[1]*5*(1-REPAIR_RESERVE);
    } else { let r=0; while(r<len){ if(fight(.35+.5*sGear, wS[1]/2, 1)) r++; else break; }
      euros+=[0,wS[1],wS[1]*2,wS[1]*4][r]*(1-REPAIR_RESERVE); }
  }
  log.sArcMin=Math.round(minutes); log.sArcEuros=Math.round(euros);
  /* — Pont : bot M d'occasion assemblé (usure ~35 %, matos mid-tier) — */
  let guard=0;
  while (euros<usedBotPrice && guard++<300){ if(fight(.35+.5*sGear, wS[2], 2)); }  // S Masters libres
  euros-=usedBotPrice; log.bridgeMin=Math.round(minutes);
  /* — Phase M : scénario D, matos de départ = le bot d'occasion — */
  let owned=new Set(); let mGear=usedBotGear;
  const buyable=UNIVERSE.slice().sort((a,b)=>a.cost-b.cost);
  const buy=()=>{ for(const it of buyable){ const k=it.slot+":"+it.id; if(owned.has(k)) continue;
      if(euros>=it.cost){ euros-=it.cost; owned.add(k); mGear=Math.min(1, usedBotGear+.65*owned.size/UNIVERSE.length); } else break; } };
  const wm=(lvl)=>wM[Math.min(lvl,wM.length-1)];
  let level=1, li=0;
  for (const lg of LEAGUES){
    const M=[1,2.5,6][li]??1; li++;
    for (const kind of lg.concours){
      let g=0; while(g<mGate){ if(fight(Math.max(.2,.35+.4*mGear-lg.oppPen), wm(level), Math.ceil(wm(level)/4))) g++; buy(); }
      const W=wm(level), pr=Math.max(.2,.35+.4*mGear-lg.oppPen);
      if (kind==="ladder"){ let st=0,gd=0;
        while(st<5&&gd++<400){ if(fight(pr,W/2*M,W/4*M)) st++; else st=Math.max(0,st-1); buy(); }
        euros+=W*5*M*(1-REPAIR_RESERVE); if(level<5) level++;
      } else if (kind==="champ"){ let wins=0;
        for(let m=0;m<10;m++){ if(fight(pr,W/2*M,W/4*M)) wins++; buy(); }
        euros+=(Math.ceil(wins*1.5)+(wins>=8?W*4:wins>=6?W*2:wins>=5?W:0))*M*(1-REPAIR_RESERVE);
      } else { let r=0; while(r<4){ if(fight(pr,W/2*M,W/4*M)) r++; else break; buy(); }
        euros+=[0,W,W*2,W*3,W*8][r]*M*(1-REPAIR_RESERVE); }
      buy();
      const pct=owned.size/UNIVERSE.length;
      if(pct>=.5&&!log.m50) log.m50=Math.round(minutes);
      if(pct>=1&&!log.m100) log.m100=Math.round(minutes);
    }
    log[lg.name]=Math.round(minutes);
  }
  Math.random=_r;
  const H=(m)=>m==null?"  —  ":(m/60).toFixed(1)+"h";
  console.log([label.padEnd(30), log.sArcMin+" min", log.sArcEuros+" €", H(log.bridgeMin),
    H(log.m50), H(log.m100), H(log.Regionale), H(log.Nationale), H(log.Internationale)].join(" | "));
}
/* ── Campagne 3 : drain de réparations par ligue (remplace la réserve 25 %).
   Coût/combat = part du revenu du combat, croissant avec la violence. ── */
function simulateRepairDrain(drains, label){
  const keep = REPAIR_RESERVE_OVERRIDE.v;
  const res=[];
  let seed=777; const _r=Math.random; Math.random=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/2**32; };
  // ré-exécution du scénario D avec drain par ligue
  let euros=0, level=1, minutes=0, owned=new Set(), post100=0;
  const buyable=UNIVERSE.slice().sort((a,b)=>a.cost-b.cost);
  const buy=()=>{ for(const it of buyable){ const k=it.slot+":"+it.id; if(owned.has(k)) continue;
      if(euros>=it.cost){ euros-=it.cost; owned.add(k); } else break; } };
  const wT=[0,12,20,32,50,80]; const w=()=>wT[Math.min(level,5)];
  const gear=()=>{ let s=0,n=0; for(const slot in SLOT_TIERS){ let b=0;
      SLOT_TIERS[slot].forEach((id,i)=>{ if(owned.has(slot+":"+id)) b=i+1; }); s+=b/SLOT_TIERS[slot].length; n++; } return s/n; };
  let li=0, m100=null;
  for (const lg of LEAGUES){
    const M=[1,2.5,6][li], drain=drains[li]; li++;
    for (const kind of lg.concours){
      const doFight=(win,lose)=>{ minutes+=FIGHT_MIN;
        const p=Math.max(.2,.35+.4*gear()-lg.oppPen), won=Math.random()<p;
        euros += (won?win:lose)*(1-drain); return won; };
      let g=0; while(g<12){ if(doFight(w(), Math.ceil(w()/4))) g++; buy(); }
      const W=w();
      if (kind==="ladder"){ let st=0,gd=0;
        while(st<5&&gd++<400){ if(doFight(W/2*M,W/4*M)) st++; else st=Math.max(0,st-1); buy(); }
        euros+=W*5*M*(1-drain); if(level<5) level++;
      } else if (kind==="champ"){ let wins=0;
        for(let m=0;m<10;m++){ if(doFight(W/2*M,W/4*M)) wins++; buy(); }
        euros+=(Math.ceil(wins*1.5)+(wins>=8?W*4:wins>=6?W*2:wins>=5?W:0))*M*(1-drain);
      } else { let r=0; while(r<4){ if(doFight(W/2*M,W/4*M)) r++; else break; buy(); }
        euros+=[0,W,W*2,W*3,W*8][r]*M*(1-drain); }
      buy(); if(owned.size>=UNIVERSE.length && m100===null) m100=minutes;
    }
  }
  Math.random=_r;
  console.log([label.padEnd(30), (minutes/60).toFixed(1)+"h total",
    m100?(m100/60).toFixed(1)+"h → 100%":"jamais 100%",
    Math.round(euros)+" € résiduels"].join(" | "));
}
const REPAIR_RESERVE_OVERRIDE={v:REPAIR_RESERVE};


/* ── E1 : scénario D officiel, paramètres lus dans les DONNÉES du jeu.
   C'est ce que qc_econ met sous fourches — toute retouche d'économie doit
   repasser dessous. ── */
function runScenarioD(){
  /* E4 : sélection PAR ID — la ligue Garage (arc S) ne fait pas partie du
     scénario M de référence. */
  const byId = Object.fromEntries(LIGUES_DATA.map(l=>[l.id, l.purseMult||1]));
  const mults = [byId.regionale||1, byId.nationale||1, byId.internationale||byId.mondiale||1];
  const gates = TOURNAMENTS_DATA.filter(t=>!(t.rules&&t.rules.chassisClass==="S"))
    .map(t=>t.unlock&&t.unlock.beaten).filter(Boolean);        // E4 : scénario M pur
  const winGate = gates.length ? Math.round((gates[gates.length-1])/gates.length) : 12;
  return simulate({ label:"D-officiel (données du jeu)",
                    wTable:WIN_EUR, leagueMults:mults, winGate });
}
module.exports = { runScenarioD };
if (require.main === module) (function(){
console.log("DRAIN RÉPARATIONS (scénario D, drain par ligue) :");
simulateRepairDrain([.10,.18,.28], "doux 10/18/28 %");
simulateRepairDrain([.15,.25,.35], "réaliste 15/25/35 %");
simulateRepairDrain([.22,.32,.45], "punitif 22/32/45 %");
console.log("");
console.log(["LONG TERME".padEnd(30),"arc S","€ fin S","achat M occ.","M 50%","M 100%","L1","L2","L3"].join(" | "));
console.log("-".repeat(120));
simulateLongTerm({label:"S doux (porte 4, bourse w=5)"});
simulateLongTerm({label:"S serré (porte 6, bourse w=4)", sGates:6, wS:[0,4,7]});
simulateLongTerm({label:"pont subventionné (occ. 180 €)", usedBotPrice:180});
simulateLongTerm({label:"sans occasion (M neuf 220+kit)", usedBotPrice:280, usedBotGear:0.22});
simulateLongTerm({label:"finale S = prime 200 € (retenu)", sGates:3, sStartBudget:40+200});
console.log("");
console.log("SCÉNARIO D OFFICIEL :", runScenarioD().line);


console.log("Univers d'achat :", UNIVERSE.length, "articles —", TOTAL_COST, "€ de contenu (classe M)");
console.log("WIN_BOLTS actuels :", JSON.stringify(WIN_BOLTS));
console.log("");
console.log(["scénario".padEnd(34),"1er achat","50% possédé","100%","L1 finie","L2 finie","L3 finie","total","possédé"].join(" | "));
console.log("-".repeat(130));
const S = [];
S.push(simulate({label:"ACTUEL (mults 1/4/15, sans porte)"}));
S.push(simulate({label:"A: mults 1/2.5/6, sans porte", leagueMults:[1,2.5,6]}));
S.push(simulate({label:"B: A + porte 8 victoires/concours", leagueMults:[1,2.5,6], winGate:8}));
S.push(simulate({label:"C: B + w=[0,12,20,32,50,80]", leagueMults:[1,2.5,6], winGate:8, wTable:[0,12,20,32,50,80]}));
S.push(simulate({label:"D: C + porte 12", leagueMults:[1,2.5,6], winGate:12, wTable:[0,12,20,32,50,80]}));
S.push(simulate({label:"E: D, mults 1/2/5", leagueMults:[1,2,5], winGate:12, wTable:[0,12,20,32,50,80]}));
for (const s of S) console.log(s.line);

/* ── enseignements gravés (22/07, première campagne) ──
   1. Le contenu M (~6 670 €) est absorbé vers le milieu de la Nationale dans
      TOUS les scénarios monétaires : l'argent ne peut pas porter la durée de
      vie seul sans prix punitifs.
   2. La durée de vie vient du VOLUME DE COMBATS (portes de palmarès), du puits
      réparations (chantier C), et des classes S/L/XL.
   3. Les gros multiplicateurs de bourse (×4/×15) n'ont de sens qu'avec les
      classes supérieures à financer — en M seul, 1/2.5/6 suffisent.
   Cible retenue (scénario D) : 1er achat <15 min, 50 % du matos ~5.5 h,
   contenu épuisé ~13.6 h de jeu pur → 3-4 semaines à 30-45 min/jour,
   AVANT réparations et classes. Le garde-fou qc_econ s'activera avec
   l'application du rééquilibrage. */

})();
