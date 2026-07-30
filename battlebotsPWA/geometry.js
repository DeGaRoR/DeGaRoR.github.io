/* geometry.js - extrait de app.js (Phase B1): geometrie/placement. */

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
  /* S24-MICRO — empreintes de la gamme micro. Une coque S fait 9 cellules
     (3×3) : avec ses roues elle héberge UN bloc 2×2 et quelques 1×1. Tout ce
     qui vise la classe S est donc 1×1, 1×2 ou 1×3 — jamais deux cellules de
     large, sinon rien d'autre n'entre à côté. */
  propulsion:{ pr0:{w:1,d:1}, pr1:{w:1,d:4}, pr2:{w:2,d:3}, pr3:{w:2,d:5},
               // S24-ROUES : 1×1 base · 1×1 blindée · 1×2 ×3 grips · 2×1 large blindée
               pr4:{w:1,d:1}, pr5:{w:1,d:1}, pr6:{w:1,d:2}, pr7:{w:1,d:2},
               pr8:{w:1,d:2}, pr9:{w:2,d:1} },  // per side, miroir L/R : 2 roues par design
  battery:{ b1:{w:2,d:2}, b2:{w:4,d:2}, b3:{w:5,d:3} },
  motor:{ m1:{w:2,d:2}, m2:{w:2,d:2}, m3:{w:3,d:2}, m4:{w:3,d:3},
          m5:{w:1,d:1}, m6:{w:1,d:2} },                                    // S24-MICRO
  cpu:{ c2:{w:2,d:1} },
  cooling:{ k1:{w:2,d:2}, k2:{w:3,d:3} },
  ballast:{ l2:{w:2,d:1} },
  sensors:{ n2:{w:2,d:1} },
  srimech:{ r1:{w:2,d:2}, r2:{w:3,d:2}, r3:{w:1,d:1}, r4:{w:1,d:2} },      // S24-MICRO
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
function isMounted(slot, id){ // E4 : "aucun" (index 0) n'occupe rien ; E7 : null = absent
  if(id == null) return false;
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
function idAt(build, slot){ const b=baseSlot(slot);
  /* E7 — coque nue : un slot explicitement null est ABSENT (pas de repli stock).
     Un slot non déclaré (builds synthétiques : adversaires, tests) garde le
     défaut historique. */
  if (build.parts && (b in build.parts) && build.parts[b] == null) return null;
  return (build.parts && build.parts[b]) || ENGINE.PARTS[b][0].id; }
function layerOf(slot){ return SLOT_LAYER[baseSlot(slot)]; }
function placedSlotsOf(build){ return [...EDIT_LAYERS[0].slots, ...instanceSlots(build)]; }
/* S20-GAMME — la teinte suit le RANG DÉCLARÉ de la pièce, plus sa position dans
   le tableau : une micro-pièce ajoutée en fin de catalogue s'affichait « haut de
   gamme ». Repli sur la position pour toute pièce qui n'aurait pas de gamme. */
function tierColor(slot,id){ const arr=ENGINE.PARTS[slot], i=arr.findIndex(p=>p.id===id);
  const g = (i>=0 && typeof arr[i].gamme === "number") ? arr[i].gamme : i;
  return TIER_COLORS[Math.max(0,Math.min(TIER_COLORS.length-1,g))]; }
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
/* ══ S16-WHEELS — placement LIBRE des roues + longerons procéduraux (25/07).
   Les roues ne sont plus tenues de toucher la coque : un écart horizontal de
   1 à BEAM_MAX cellules est ponté par un LONGERON dérivé (jamais stocké).
   Par rangée de l'empreinte roue (côté gauche) : la première cellule de coque
   vers l'axe donne l'écart ; 0 = attache directe, 1..BEAM_MAX = segment de
   longeron, au-delà = rangée non attachée. Une roue est VALIDE si au moins
   une rangée s'attache. Miroir garanti par symétrie des coques (tous les
   masques actuels sont symétriques). Le longeron existe PHYSIQUEMENT :
   masse (ENGINE.BEAM_KG/cellule ×2 côtés), colliders (slot null → les chocs
   comptent coque ; l'arrachage viendra au chantier armes), CG. Écart 0 =
   zéro longeron = zéro masse : le trio S 1,36 kg PILE est préservé. ══ */
const BEAM_MAX = 2;
function beamsForWheel(chassis, pos, f){
  /* S16-WHEELS v3 (retrade 25/07) — UNE seule barre par roue, pas une par
     rangée : le pod est tenu par un longeron unique, posé au CENTRE VERTICAL
     de la roue et tendu jusqu'à la coque la plus proche. La validité reste
     analysée rangée par rangée (la roue tient si UNE rangée atteint la
     coque), mais la pièce produite est unique — donc masse, colliders et
     dessin le sont aussi. */
  let attached=false, minHull=Infinity;
  for(let dr=0; dr<f.d; dr++){
    const r=pos.row+dr;
    if(r<0 || r>=gridH(chassis)) continue;
    let onHull=false;                                  // la roue chevauche la coque sur cette rangée
    for(let c=pos.col; c<pos.col+f.w; c++) if(cellInChassis(chassis,c,r)){ onHull=true; break; }
    if(onHull){ return { valid:true, bar:null, cells:0 }; }
    let hull=-1;                                       // première cellule de coque vers l'axe
    for(let c=pos.col+f.w; c<gridW(chassis); c++) if(cellInChassis(chassis,c,r)){ hull=c; break; }
    if(hull<0) continue;
    const gap=hull-(pos.col+f.w);
    if(gap===0) return { valid:true, bar:null, cells:0 };            // attache directe : pas de longeron
    if(gap<=BEAM_MAX){ attached=true; if(hull<minHull) minHull=hull; }
  }
  if(!attached || !isFinite(minHull)) return { valid:attached, bar:null, cells:0 };
  const bar={ rowC:pos.row+f.d/2, c0:pos.col+f.w, c1:minHull-1 };     // centre vertical de la roue
  return { valid:true, bar, cells:bar.c1-bar.c0+1 };
}
function drawBeams(c, build, layout, dark){
  const b=beamsOf(build, layout).bar; if(!b) return;
  const chassis=build.chassis, v=viewParams(chassis);
  const TH=v.cell*0.26, RH=Math.max(1.6, v.cell*0.11), gcx=gridCX(chassis);
  const y=(b.rowC-v.crow)*v.cell;                       // centre vertical de la roue
  const bar=(c0,c1)=>{
    const x0=(c0-v.ccol)*v.cell-v.cell*0.16, x1=(c1+1-v.ccol)*v.cell+v.cell*0.16;
    c.fillStyle = dark ? "#3c4046" : "#8b919b"; c.fillRect(x0, y-TH/2, x1-x0, TH);
    c.fillStyle = dark ? "#2a2d32" : "#3a3f47";         // deux têtes de rivet
    for(const rx of [x0+RH*1.2, x1-RH*1.2]){ c.beginPath(); c.arc(rx, y, RH, 0, 7); c.fill(); } };
  bar(b.c0, b.c1);
  bar(2*gcx-b.c1-1, 2*gcx-b.c0-1);                      // miroir droit
}
function beamsOf(build, layout){                       // longerons du bot (côté gauche ; le droit est miroir)
  const p=(layout&&layout.propulsion)||{col:0,row:0};
  const f=footprintOf("propulsion", idAt(build,"propulsion"));
  return beamsForWheel(build.chassis||"boxy", p, f);
}
function beamCellsOf(build, layout){ return beamsOf(build, layout).cells*2; }  // deux côtés
function placementOK(chassis, slot, pos, others){
  const f=footprintOf(slot, curId(slot));
  if(SLOT_LAYER[slot]===0){ // propulsion (left side); right side is its mirror
    if(pos.col + f.w > gridCX(chassis)) return false;          // left side stays left of the axis
    if(pos.col < -BEAM_MAX) return false;                      // S16-WHEELS : débord borné par la portée des longerons
    if(!beamsForWheel(chassis, pos, f).valid) return false;    // au moins une rangée attachée (direct ou longeron)
    const mc=mirrorCol(chassis,pos.col,f.w);
    return noOverlap(pos,f,others) && noOverlap({col:mc,row:pos.row},f,others);
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
function curId(slot){
  const eq = S.parts && S.parts.equipped;
  if (eq && (slot in eq) && eq[slot] == null) return null;               // E7 : absent
  return (eq && eq[slot]) || ENGINE.PARTS[slot][0].id; }
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
    /* S16-WHEELS — défaut inchangé : l'attache directe la plus EXTÉRIEURE
       (balayage ascendant depuis 0, comme l'historique touchesChassis).
       Les longerons ne servent qu'en repli si aucune attache directe
       n'existe : l'arrangeur ne déporte jamais de lui-même, c'est un
       choix du joueur. */
    let pcol=null;
    const ccMax=Math.floor(gridCX(chassis)-fP.w);
    for(let cc=0; cc<=ccMax; cc++){
      const bi=beamsForWheel(chassis,{col:cc,row:prow},fP);
      if(bi.valid && bi.cells===0){ pcol=cc; break; } }
    /* S34-DEPORT — le repli balayait depuis -BEAM_MAX et prenait le PREMIER
       valide, donc la position la plus EXTERIEURE possible : c'est ce qui
       gonflait la boite de collision. On cherche desormais du plus proche de la
       coque vers le large — attache sur coque d'abord, puis 1 cellule de
       longeron, puis 2. */
    if(pcol===null) for(let cc=0; cc<=ccMax; cc++){
      if(beamsForWheel(chassis,{col:cc,row:prow},fP).valid){ pcol=cc; break; } }
    if(pcol===null) for(let cc=-1; cc>=-BEAM_MAX; cc--){
      if(beamsForWheel(chassis,{col:cc,row:prow},fP).valid){ pcol=cc; break; } }
    if(pcol===null) return null;
    T.propulsion={col:pcol,row:prow};
    /* S34-CALQUE — les roues sont sur LEUR PROPRE CALQUE. Elles ne reservent
       rien a l'equipement et l'equipement ne les repousse pas : une roue peut
       mordre sur la coque, c'est la doctrine d'origine.
       Ce que faisait le code d'avant : `pool = propulsionRects(build, T)`.
       Deux roues 1x2 mangeaient 4 des 9 cellules d'une coque S, plus rien ne
       logeait, et l'arrangeur partait au repli longeron qui deporte au large.
       Mesure : pr4/pr6/pr8 rendaient __nofit sur tortue_s avec un kit de base,
       et pr2/pr3 passaient avec une hitbox de 25 a 31 u pour un rayon de 9,5. */
    const pool=[];
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
      .map(o=>({...layout[o], f:footprintOf(o, idFor(o))}));
    /* S34-CALQUE — la propulsion ne compte plus comme occupation pour
       l'equipement (elle etait concatenee ici). Meme doctrine que autoArrange :
       sans ca, une mise en page valide etait rejetee au rechargement. */
    // temporarily evaluate with the equipped id of THIS slot
    const f=footprintOf(slot, idFor(slot));
    const li=layerOf(slot);
    const flOK = (p.floor||0) === 0;                 // plan unique : plus d'étages
    let geomOK, symOK=true;
    if(li===0){ // propulsion: left side left of axis, both mirrored sides mount
      symOK = p.col + f.w <= gridCX(build.chassis) && p.col >= -BEAM_MAX;
      geomOK = beamsForWheel(build.chassis, p, f).valid;       // S16-WHEELS : attache directe ou longeron
    } else if(li===1){ geomOK = PROTRUDE_OK[baseSlot(slot)]
        ? anchoredOnChassis(build.chassis,p,f)
        : fullyContained(build.chassis,p,f); }
    else { geomOK = anchoredOnChassis(build.chassis,p,f); }
    if(!(geomOK && symOK && flOK && noOverlap(p,f,others))) return false;
  }
  return true;
}
/* S16-EDIT — réparation INCRÉMENTALE du layout. Monter une pièce (2e moteur)
   déclenchait un autoArrange COMPLET qui déplaçait les roues et tout le
   reste. Désormais : chaque position existante encore légale est CONSERVÉE
   (la propulsion d'abord — elle structure le bassin), et seuls les slots
   nouveaux ou devenus illégaux sont placés dans les cellules restées libres.
   Repli honnête : autoArrange complet si l'incrémental ne loge pas tout. */
function repairLayout(build, old){
  if (!old || old.__nofit) return autoArrange(build);
  const chassis = build.chassis, idOf = (s)=>idAt(build, s);
  const fP = footprintOf("propulsion", idOf("propulsion"));
  const pp = old.propulsion;
  const pOK = pp && pp.col + fP.w <= gridCX(chassis) && pp.col >= -BEAM_MAX
           && beamsForWheel(chassis, pp, fP).valid;
  if (!pOK) return autoArrange(build);
  const L = { propulsion: {col:pp.col, row:pp.row} };
  /* S34-CALQUE — troisieme et dernier site : le placeur INCREMENTAL comptait lui
     aussi les roues dans l'occupation. Consequence directe, attrapee par S16A :
     une piece deja posee qui mordait sur une roue etait jugee illegale en 1re
     passe et se faisait DEPLACER — les pieces sautaient en ajoutant un 2e
     moteur. Meme doctrine partout : les roues n'occupent rien. */
  const pool = [];
  const eqList = instanceSlots(build).sort((a,b)=>{
    const fa=footprintOf(a,idOf(a)), fb=footprintOf(b,idOf(b));
    return fb.w*fb.d - fa.w*fa.d; });
  const missing = [];
  for (const slot of eqList){                                   // 1re passe : garder l'existant légal
    if (!isMounted(baseSlot(slot), idOf(slot))){ L[slot] = old[slot] || {col:0,row:0}; continue; }
    const f = footprintOf(slot, idOf(slot));
    const p = old[slot];
    const mode = PROTRUDE_OK[baseSlot(slot)] ? "anchor" : "contain";
    const geomOK = p && (mode==="anchor" ? anchoredOnChassis(chassis,p,f) : fullyContained(chassis,p,f));
    if (geomOK && noOverlap(p, f, pool)){ L[slot]={col:p.col,row:p.row}; pool.push({col:p.col,row:p.row,f}); }
    else missing.push(slot);
  }
  for (const slot of missing){                                  // 2e passe : loger le nouveau dans les trous
    const f = footprintOf(slot, idOf(slot));
    const mode = PROTRUDE_OK[baseSlot(slot)] ? "anchor" : "contain";
    const pos = firstFit(chassis, f, pool, mode);
    if (!pos) return autoArrange(build);
    L[slot] = {...pos}; pool.push({...pos, f});
  }
  return layoutValid(build, L) ? L : autoArrange(build);
}
function getLayout(){ // player layout, auto-repaired if stale/illegal
  const build={chassis:AB().chassis, parts:{...S.parts.equipped}, counts:{...AB().counts}};
  if(AB().layout && layoutValid(build, AB().layout)) return AB().layout;
  const L=repairLayout(build, AB().layout); AB().layout=L; return L;   // S16-EDIT : incrémental d'abord
}
