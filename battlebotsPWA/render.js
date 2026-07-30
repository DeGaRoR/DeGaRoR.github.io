/* render.js - extrait de app.js (Phase B2): rendu (registres image/tuile, composite,
   colliders, CG, dessin editeur, primitives de dessin bot). Chargement apres geometry,
   avant app. Ne reference S/AB/match/editDrag qu au runtime. */

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
/* ══ S17-IMG — chargement d'images UNIFIÉ (25/07). Un seul registre, trois
   états explicites (pending / ready / failed), une seule invalidation. Avant :
   `onload → tilesDirty` sans `onerror` (une image morte laissait un trou
   silencieux et definitif), et les fonds d'atelier chargeaient hors registre.
   Le pouls de chargement (sheen) ne tourne QUE tant qu'une image est en vol :
   il s'eteint tout seul, zero rAF permanent. ══ */
const IMG_REG = {};                       // src -> { img, state }
function mkImg(src){
  if(typeof Image==="undefined") return null;
  const hit = IMG_REG[src]; if (hit) return hit.img;      // dedup global
  const im = new Image();
  const rec = IMG_REG[src] = { img:im, state:"pending" };
  im.onload  = ()=>{ rec.state="ready";  visualsDirty(); };
  im.onerror = ()=>{ rec.state="failed"; logError("image", "chargement echoue: "+src); visualsDirty(); };
  im.src = src;
  startLoadPulse();
  return im;
}
function imgState(src){ const e=IMG_REG[src]; return e ? e.state : "ready"; }
function imgReady(im){ return !!(im && im.complete && im.naturalWidth>0); }
function imagesPending(){ for(const k in IMG_REG) if(IMG_REG[k].state==="pending") return true; return false; }
/* pouls de chargement : ~11 images/s, s'arrete des que tout est charge */
let LOAD_PHASE = 0, _loadRaf = 0, _loadLast = 0;
function startLoadPulse(){
  if (_loadRaf || typeof requestAnimationFrame==="undefined") return;
  const step = (ts)=>{
    LOAD_PHASE = (ts||0)/1000;
    const more = imagesPending();
    if (!_loadLast || ts-_loadLast > 90){ _loadLast = ts; tilesDirty(); }
    _loadRaf = more ? requestAnimationFrame(step) : 0;
    if (!more) tilesDirty();                              // derniere passe : etat final, sheen eteint
  };
  _loadRaf = requestAnimationFrame(step);
}
/* Invalidation UNIQUE de tout le visuel. Aujourd'hui elle se ramène à
   tilesDirty() : les seules vues NON enregistrées (éditeur, portraits VS)
   sont redessinées à chaque frame par previewLoop, donc rien à réveiller.
   Point d'entrée conservé pour que les appelants n'aient jamais à savoir
   quelles vues existent — si une vue hors boucle apparaît, elle se branche
   ICI et nulle part ailleurs. */
function visualsDirty(){ tilesDirty(); }
/* placeholder commun : la VRAIE silhouette, balayee par un sheen tant que
   l'image charge. Rien de clignotant, rien de bloquant — juste un signe. */
function drawLoadSheen(c, x, y, w, h, state){
  if (state !== "pending") return;                        // "failed" : le repli vectoriel EST l'etat final
  try{
    const p = (LOAD_PHASE*0.55) % 1.6 - 0.3;              // balayage lent, avec temps mort
    const g = c.createLinearGradient(x + w*(p-0.22), y, x + w*(p+0.22), y+h);
    g.addColorStop(0,   "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,.16)");
    g.addColorStop(1,   "rgba(255,255,255,0)");
    c.save(); c.fillStyle = g; c.fillRect(x, y, w, h); c.restore();
  }catch(_){}
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
  /* S16-CRASH — un rayon 0/NaN donnerait un canvas de taille invalide, et
     drawImage d'un canvas vide JETTE en navigateur réel (pas en jsdom).
     Suspect n°1 du gel playtest : on borne, et la boîte noire journalise. */
  let S = Math.ceil(bot.radius*2.9 + 34), Q = 2;
  if (!isFinite(S) || S < 8){ logError("composite", "radius invalide: "+bot.radius); S = 64; }
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
function tintedChassis(ch, color){ const st=spriteState(ch);
  if (color === NO_TINT || !color) return st.img;                       // E8 : blanc = sprite nu
  if(st.tint[color]) return st.tint[color];
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
  /* S21-COLLIDER — garde de mise en page. Quand autoArrange échoue (__nofit),
     il empile tout l'équipement en {col:0,row:0} : la roue MIROIR se retrouve
     alors très loin hors grille et la boîte de collision explose — mesuré à
     52 u de rayon pour une coque S de 10 u, sur un ring de 62 u. Un adversaire
     généré dans cet état remplissait presque l'arène de sa hitbox (31 sur 40
     adversaires S de niveau 3 étaient dans ce cas).
     Règle : ce qu'on n'a pas su placer ne dépasse pas. On retombe sur la
     COQUE SEULE — jamais plus gros que le châssis, jamais d'exception. */
  const nofit = !!(layout && layout.__nofit);
  const v=viewParams(chassis), vis=colliderVis(chassis), list=[];
  const cr=0.6*v.cell; // small per-cell circle: mild overlap, tight union
  const cell=(cc,r,slot,rk)=> list.push({slot, x:-vis*(r+0.5-v.crow)*v.cell, y:vis*(cc+0.5-v.ccol)*v.cell, r:vis*cr*(rk||1)});
  const paveFoot=(col,row,f,slot)=>{ for(let dc=0;dc<f.w;dc++) for(let dr=0;dr<f.d;dr++) cell(col+dc,row+dr,slot); };
  /* S16-WHEELS — les longerons collisionnent (WYSIWYG) : slot null → un choc
     direct compte coque. L'arrachage individuel viendra au chantier armes. */
  if(!nofit){ const b=beamsOf(build, layout).bar;
    if(b) for(let c=b.c0;c<=b.c1;c++){
      cell(c, b.rowC-0.5, null);                       // rowC = centre vertical de la roue
      cell(2*gridCX(chassis)-c-1, b.rowC-0.5, null);   // miroir droit
    } }
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
  if(!nofit){ const aid=eq.armor||"a0", aidx=ENGINE.PARTS.armor.findIndex(p=>p.id===aid);
    if(aidx>0){ for(let cc=0;cc<gridW(chassis);cc++){ // one cell ahead of each column's front-most hull cell
      for(let r=0;r<gridH(chassis);r++){ if(cellInChassis(chassis,cc,r)){ cell(cc, r-1, "armor"); break; } } } } }
  // propulsion: pave both mirrored side footprints — avec le MÊME débord
  // extérieur de 0.32 cellule que le dessin (P-OMBRES, WYSIWYG).
  if(!nofit){ const id=eq.propulsion||ENGINE.PARTS.propulsion[0].id, f=footprintOf("propulsion",id);
    const p=layout.propulsion||{col:0,row:0};
    const OUT=0.32;
    /* S34-WYSIWYG — le pavage suivait le RECTANGLE D'EMPREINTE, pas le dessin.
       Une pr2 (2x3) posait six disques par cote la ou le sprite ne montre que
       deux roues : la hitbox debordait visiblement du visuel. drawPartTile cale
       le sprite en CONTAIN sur ses bornes alpha (x1,04) ; on reprend exactement
       ce facteur pour retrecir le pavage autour du centre de l'empreinte. */
    let kx=1, ky=1;
    try{ const spr=componentSprite("propulsion", id);
      if(spr && spr.naturalWidth>0){
        const ab=spriteAlphaBounds(spr);
        const wpx=f.w*v.cell-CELL_GAP, hpx=f.d*v.cell-CELL_GAP;
        const s=Math.min(wpx/ab.w, hpx/ab.h)*1.04;
        kx=Math.min(1, (ab.w*s)/(f.w*v.cell));
        ky=Math.min(1, (ab.h*s)/(f.d*v.cell));
      } }catch(_){ kx=1; ky=1; }
    const rk=Math.min(kx,ky), mc=mirrorCol(chassis,p.col,f.w);
    const cCx=p.col+f.w/2-0.5, cCy=p.row+f.d/2-0.5, mCx=mc+f.w/2-0.5;
    for(let dc=0;dc<f.w;dc++) for(let dr=0;dr<f.d;dr++){
      const rr=cCy+(p.row+dr-cCy)*ky;
      cell(cCx+(p.col+dc-cCx)*kx-OUT, rr, "propulsion", rk);
      cell(mCx+(mc+dc-mCx)*kx+OUT, rr, "propulsion", rk); } }
  // externals (weapons/sensors) overhang the hull; internals are interior → not on the surface

  let bound=0; for(const c of list) bound=Math.max(bound, Math.hypot(c.x,c.y)+c.r);
  /* S34-PLAFOND — la garde S21 ne se declenchait qu'a __nofit. Or une mise en
     page qui REUSSIT peut deporter les roues assez loin pour que la boite
     depasse tout ce que le dessin justifie : mesure a 25 u (pr2) et 31 u (pr3)
     pour une coque S de 9,5 de rayon, soit un mur invisible sur un ring de 62.
     Regle inconditionnelle : au-dela de CAP fois le rayon de coque, on retombe
     sur la COQUE SEULE. Ce qu'on n'a pas su placer ne depasse pas. */
  const CAP=2.4, rad=(ENGINE.CHASSIS[chassis]||{}).radius||10;
  if(bound > CAP*rad){
    const hull=list.filter(c=>c.slot==="chassis");
    if(hull.length){ let b2=0; for(const c of hull) b2=Math.max(b2, Math.hypot(c.x,c.y)+c.r);
      return { list:hull, bound:b2, capped:true }; } }
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
  /* S16-WHEELS — longerons : masse au ras du plancher, aux positions réelles
     (les deux côtés se compensent en x, la contribution y/z reste vraie). */
  { const b=beamsOf(build, layout).bar;
    if(b) for(let c=b.c0;c<=b.c1;c++)
      add(2*ENGINE.BEAM_KG, 0, (b.rowC-centerRow)*CELL_CM, LAYER_ELEV_CM.chassis*0.5); }
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
function viewParams(chassis){ const b=chassisBounds(chassis);
  /* S16-EDIT — marge par classe : fenetre S ~8,7 cellules = 26 cm (arbitrage
     25/07, coques S un poil plus petites), M inchangee (10 cellules = 30 cm). */
  const M = chassisClassOf(chassis)==="S" ? 2.8 : 2; // cells of margin for overhang
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
  /* S17-IMG — repli = la VRAIE silhouette de coque, balayee par le sheen tant
     que le sprite charge : le joueur voit la bonne forme tout de suite et sait
     qu'une image arrive. Si le chargement echoue, ce repli devient definitif. */
  c.save(); c.fillStyle=color||DEFAULT_CHASSIS_COLOR; c.strokeStyle="#3f4654"; c.lineWidth=2;
  chassisOutlinePath(c, chassis); c.fill(); c.stroke();
  const st=spriteState(chassis);
  if(st && st.def){
    c.clip();                                             // le sheen epouse la coque
    const b=chassisBounds(chassis), v=viewParams(chassis);
    const x=(b.minC-v.ccol)*v.cell, y=(b.minR-v.crow)*v.cell;
    drawLoadSheen(c, x, y, (b.maxC-b.minC+1)*v.cell, (b.maxR-b.minR+1)*v.cell, imgState(st.def.src));
  }
  c.restore(); }
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
const ALPHA_BOUNDS = {};                 // S16-EDIT : cache des bornes utiles par sprite
function spriteAlphaBounds(spr){
  const key = spr.src || "";
  if (ALPHA_BOUNDS[key]) return ALPHA_BOUNDS[key];
  let b = { x:0, y:0, w:spr.naturalWidth, h:spr.naturalHeight };   // repli : plein cadre
  try{
    const W = Math.min(96, spr.naturalWidth);
    const H = Math.max(1, Math.round(W*spr.naturalHeight/spr.naturalWidth));
    const cv = document.createElement("canvas"); cv.width=W; cv.height=H;
    const cc = cv.getContext("2d", {willReadFrequently:true});
    cc.drawImage(spr, 0, 0, W, H);
    const d = cc.getImageData(0, 0, W, H).data;
    let x0=W, y0=H, x1=-1, y1=-1;
    for (let y=0; y<H; y++) for (let x=0; x<W; x++)
      if (d[(y*W+x)*4+3] > 24){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
    if (x1 >= x0){
      const kx = spr.naturalWidth/W, ky = spr.naturalHeight/H;
      b = { x:x0*kx, y:y0*ky, w:(x1-x0+1)*kx, h:(y1-y0+1)*ky };
    }
  }catch(_){ /* jsdom / image inaccessible : plein cadre */ }
  ALPHA_BOUNDS[key] = b; return b;
}
function drawPartTile(c, slot, id, cx, cy, wpx, hpx, spin=0, alpha=1, slip=0, mirror=false){
  const spr = componentSprite(slot, id);
  if(spr && spr.complete && spr.naturalWidth>0){
    c.save(); c.globalAlpha=alpha; c.translate(cx,cy); if(mirror) c.scale(-1,1);
    /* S16-EDIT — fit sur les BORNES ALPHA du sprite, pas sur son cadre : les
       marges d'air varient par asset (95×128 px pour une roue 1×2...), donc
       le cadre mentait. L'art utile remplit maintenant l'empreinte à marge
       constante — écarts inter-composants et boîtes fantômes disparaissent.
       Dérivé (mesuré au chargement, caché), jamais stocké. */
    const ab=spriteAlphaBounds(spr);
    const s=Math.min(wpx/ab.w, hpx/ab.h)*1.04;
    const dw=ab.w*s, dh=ab.h*s;
    c.drawImage(spr, ab.x, ab.y, ab.w, ab.h, -dw/2, -dh/2, dw, dh);
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
  /* S17-IMG — meme langage que la coque : la tuile de repli porte le sheen
     tant que le sprite du composant charge (liste de pieces comprise). */
  { const t2=COMPONENT_SPRITES[slot], d=t2&&t2[id];
    if(d) drawLoadSheen(c, cx-wpx/2, cy-hpx/2, wpx, hpx, imgState(d.src)); }
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
    drawBeams(c, build, layout, true);                                    // S16-WHEELS v3 : sous la coque
    drawChassisBoard(c, chassis, mixHex(build.color||DEFAULT_CHASSIS_COLOR, "#14161c", 0.55));

    const id=eq.propulsion||ENGINE.PARTS.propulsion[0].id, f=footprintOf("propulsion",id);
    const p=layout.propulsion||{col:0,row:0};
    for(const [ci,col] of [[0,p.col],[1,mirrorCol(chassis,p.col,f.w)]]){ const b=slotBox(chassis,"propulsion",id,{col,row:p.row});
      drawPartTile(c, "propulsion", id, b.cx, b.cy, b.wpx, b.hpx, spin*0.3, 1, 0, ci===1); }
    return;
  }
  /* S16-WHEELS v3 — longeron : UNE barre par roue, au centre vertical du pod,
     dessinée AVANT la coque — donc SOUS le châssis et sous les roues (z bas).
     Une simple branche + deux têtes de rivet, rien d'autre (arbitrage 25/07). */
  drawBeams(c, build, layout);
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
    if(id == null) return;                                               // E7 : slot nu
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
        /* S18 — taille dérivée de la CLASSE (données STICKER_SCALE) : le même
           autocollant couvrait 27 % d'une coque M mais 53 % d'une coque S. */
        const k = STICKER_SCALE[chassisClassOf(chassis)] || 1;
        const hgt = v.cell*1.6*k, wdt = Math.min(hgt*st.w/st.h, v.cell*4.2*k), h2 = wdt*st.h/st.w;
        c.drawImage(im, cx*v.cell - wdt/2, cy*v.cell - h2/2, wdt, h2);
      } else { c.fillStyle="rgba(255,255,255,.25)"; c.fillRect(cx*v.cell-6, cy*v.cell-6, 12, 12); } }
    c.restore(); }
}
const EDITOR_BG = { S:"assets/bg_s_nerd.webp", M:"assets/bg_s_mat.webp" };   // E5 : par classe
const _edBg = {};
function editorBgImg(cls){ const src=EDITOR_BG[cls]||EDITOR_BG.M;
  if(!_edBg[src]) _edBg[src]=mkImg(src);                       // S17-IMG : registre commun
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
  const sc=(Math.min(w,h)*BOT_FRAME)/BOARD_HALF; c.scale(sc,sc);   // S17-VIEW : constante partagee
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
      /* S16-EDIT — la boîte suit l'ART DESSINÉ (bornes alpha × fit), plus la
         cellule brute : fini le cadre qui flotte à côté de la pièce. */
      const p = layout[editDrag.slot], f = footprintOf(editDrag.slot, curId(editDrag.slot));
      const bs = baseSlot(editDrag.slot);
      let bx=(p.col-v.ccol)*v.cell, by=(p.row-v.crow)*v.cell, bw=f.w*v.cell, bh=f.d*v.cell;
      const spr = componentSprite(bs, curId(editDrag.slot));
      if (spr && spr.complete && spr.naturalWidth>0){
        const ab=spriteAlphaBounds(spr);
        const s=Math.min((f.w*v.cell)/ab.w,(f.d*v.cell)/ab.h)*1.04;
        const dw=ab.w*s, dh=ab.h*s, ocx=bx+bw/2, ocy=by+bh/2;
        bx=ocx-dw/2; by=ocy-dh/2; bw=dw; bh=dh;
      }
      if (bs==="propulsion") bx -= v.cell*0.32;                 // débord extérieur des roues
      c.strokeRect(bx-3, by-3, bw+6, bh+6);
    } else if (editDrag.sticker != null && S.customize.placed[editDrag.sticker]){
      const d = S.customize.placed[editDrag.sticker];
      const cx = (d.x ?? d.col+0.5) - v.ccol, cy = (d.y ?? d.row+0.5) - v.crow;
      const ks = STICKER_SCALE[chassisClassOf(build.chassis)] || 1;      // S18 : anneau a l'echelle
      c.beginPath(); c.arc(cx*v.cell, cy*v.cell, v.cell*0.95*ks, 0, Math.PI*2); c.stroke();
    }
    c.shadowBlur = 0;
  }
  c.restore();
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
