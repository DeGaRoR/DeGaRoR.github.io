/* ================================================================
   LE GRAND ATLAS DU TEMPS PROFOND — app.js
   Application locale, mono-utilisatrice. Rien ne quitte l'appareil.
   Sauvegarde : localStorage, clé ATLAS_CLE.

   BOUCLE DE JEU
     Bourse   → missions d'entraînement (français, maths) ou d'histoire.
                L'entraînement paie mieux : il coûte plus d'effort.
     Fouille  → débloquer un site (coût unique), lire son introduction,
                puis chaque coup de pioche coûte des crédits ET exige de
                répondre juste à une question du site. Juste → tirage.

   SECTIONS
     1. Utilitaires       2. État        3. Navigation et fonds
     4. Fouille           5. Collection  6. Bourse       7. Init
   ================================================================ */
const VERSION_APP='v2';

/* ---------------- 1. Utilitaires ---------------- */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const pioche=a=>a[rnd(0,a.length-1)];
function melange(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=rnd(0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

let toastT=null;
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('on');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),2800);
}
/* Chargement d'image en arrière-plan : jamais d'écran vide si le fichier tarde. */
function setFondImg(el,url,grad){
  if(!el)return;
  el.classList.remove('img-load');
  if(!url){el.style.backgroundImage=''; return;}
  el.classList.add('img-load');
  const im=new Image();
  const done=()=>{el.style.backgroundImage=(grad?grad+', ':'')+'url("'+url+'")'; el.classList.remove('img-load');};
  im.onload=done; im.onerror=done; im.src=url;
}
let ancreGain=null;
function gainAnim(n){
  if(!(n>0))return;
  let a=(ancreGain&&ancreGain.isConnected)?ancreGain:null; ancreGain=null;
  if(!a)a=$('#solde'); if(!a)return;
  const r=a.getBoundingClientRect();
  const lab=document.createElement('div');
  lab.className='gain-pop'+(n>=20?' xl':'');
  lab.textContent='+'+n;
  lab.style.left=(r.left+r.width/2)+'px'; lab.style.top=(r.top+r.height/2)+'px';
  document.body.appendChild(lab); setTimeout(()=>lab.remove(),1200);
}

/* ---------------- 2. État ---------------- */
const ATLAS_CLE='atlas_temps_profond_v1';   // sauvegarde d'avant les profils
const PROFILS_CLE='atlas_profils_v1';       // registre des profils
const ETAT_PREFIXE='atlas_etat_';           // une clé d'état par profil
const SCHEMA=1;                             // version du format d'échange

function etatVide(){
  return {credits:CREDITS_DEPART, collection:{}, packprog:{}, sitesOuverts:{},
          introVue:{}, sitesBonus:{}, qSite:{}, fouilles:0, echecs:0,
          stats:{}, ordre:{}, ordreN:0, tri:'chantier', accueilVu:false};
}
function normaliser(e){const d=etatVide(); for(const k in d) if(e[k]===undefined) e[k]=d[k]; return e;}

/* ---------- Profils locaux ----------
   Tout reste dans localStorage : aucun compte, aucun mot de passe, aucun serveur.
   « Profil » veut seulement dire « une progression séparée », pour que deux
   personnes puissent jouer sur le même appareil sans se marcher dessus.

   Le format d'export est volontairement plus large que ce qu'il faut ici :
   il porte un numéro de schéma, la version de l'application et l'horodatage.
   Une synchronisation distante n'aurait qu'à transporter cet objet tel quel,
   sans que le reste du code ait à changer. */
const litJSON=c=>{try{const b=localStorage.getItem(c);return b?JSON.parse(b):null;}catch(e){return null;}};
const ecritJSON=(c,v)=>{try{localStorage.setItem(c,JSON.stringify(v));return true;}
  catch(e){toast('Enregistrement impossible'); return false;}};
const cleEtat=id=>ETAT_PREFIXE+id;
const idNeuf=()=>'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

function registreVide(){return {actif:null, liste:[]};}

/* Une sauvegarde d'avant les profils devient le premier profil, sans rien perdre.
   L'ancienne clé est conservée telle quelle : si quelque chose tourne mal, la
   progression d'origine est encore là. */
function lireRegistre(){
  let r=litJSON(PROFILS_CLE);
  if(r && Array.isArray(r.liste) && r.liste.length) return r;
  r=registreVide();
  const ancien=litJSON(ATLAS_CLE);
  const id=idNeuf();
  r.liste.push({id, nom:'Profil 1', cree:Date.now(), vue:Date.now()});
  r.actif=id;
  ecritJSON(cleEtat(id), normaliser(ancien||etatVide()));
  ecritJSON(PROFILS_CLE, r);
  return r;
}

let registre=lireRegistre();
const profilActif=()=>registre.liste.find(p=>p.id===registre.actif)||registre.liste[0];
let etat=normaliser(litJSON(cleEtat(registre.actif))||etatVide());

function sauver(){
  const p=profilActif(); if(p) p.vue=Date.now();
  ecritJSON(cleEtat(registre.actif), etat);
  ecritJSON(PROFILS_CLE, registre);
}

function basculerProfil(id){
  if(id===registre.actif) return fermerReglages();
  sauver();
  registre.actif=id;
  etat=normaliser(litJSON(cleEtat(id))||etatVide());
  ecritJSON(PROFILS_CLE, registre);
  fermerReglages();
  siteActif=null;
  majNomProfil(); majSolde(); majFondGlobal(); vueCarte(); montrer('fouille');
  if(besoinAccueil()) ouvrirAccueil();
  else toast('Profil : '+(profilActif()||{}).nom);
}

function creerProfil(nom){
  nom=(nom||'').trim().slice(0,24) || ('Profil '+(registre.liste.length+1));
  const id=idNeuf();
  registre.liste.push({id, nom, cree:Date.now(), vue:Date.now()});
  ecritJSON(cleEtat(id), etatVide());
  ecritJSON(PROFILS_CLE, registre);
  basculerProfil(id);
}

function renommerProfil(id,nom){
  const p=registre.liste.find(x=>x.id===id); if(!p) return;
  nom=(nom||'').trim().slice(0,24); if(!nom) return;
  p.nom=nom; ecritJSON(PROFILS_CLE, registre); majNomProfil(); ouvrirReglages();
}

/* On ne supprime jamais le dernier profil : il n'y aurait plus rien où revenir. */
function supprimerProfil(id){
  if(registre.liste.length<=1) return toast('C’est le seul profil');
  registre.liste=registre.liste.filter(p=>p.id!==id);
  try{localStorage.removeItem(cleEtat(id));}catch(e){}
  if(registre.actif===id){
    registre.actif=registre.liste[0].id;
    etat=normaliser(litJSON(cleEtat(registre.actif))||etatVide());
  }
  ecritJSON(PROFILS_CLE, registre);
  majSolde(); ouvrirReglages();
}

/* ---- Échange de progression ----
   Le fichier produit se suffit à lui-même : on peut le lire, le sauvegarder
   ailleurs, le réimporter sur un autre appareil. C'est aussi exactement ce
   qu'une synchronisation distante aurait à téléverser. */
function paquetProgression(){
  const p=profilActif()||{nom:'Profil'};
  return {app:'gronosaures', schema:SCHEMA, version:VERSION_APP,
          exporte:new Date().toISOString(),
          profil:{nom:p.nom, cree:p.cree||null},
          resume:{creatures:trouvees().length, total:CREATURES.length,
                  chantiers:SITES.filter(s=>etat.sitesOuverts[s.id]).length,
                  credits:etat.credits},
          etat:etat};
}

function exporterProgression(){
  try{
    const p=profilActif()||{nom:'profil'};
    const nom='gronosaures-'+p.nom.toLowerCase().replace(/[^a-z0-9]+/g,'-')
      +'-'+new Date().toISOString().slice(0,10)+'.json';
    const b=new Blob([JSON.stringify(paquetProgression(),null,2)],{type:'application/json'});
    const u=URL.createObjectURL(b);
    const a=document.createElement('a');
    a.href=u; a.download=nom; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(u); a.remove();},0);
    toast('Progression exportée');
  }catch(e){ toast('Export impossible'); }
}

/* L'import crée toujours un NOUVEAU profil : écraser une progression existante
   par mégarde serait irréparable, alors qu'un profil en trop se supprime. */
function importerProgression(fichier){
  if(!fichier) return;
  const fr=new FileReader();
  fr.onerror=()=>toast('Lecture impossible');
  fr.onload=()=>{
    let d=null;
    try{ d=JSON.parse(fr.result); }catch(e){ return toast('Fichier illisible'); }
    if(!d || d.app!=='gronosaures' || !d.etat) return toast('Ce n’est pas un export de l’atlas');
    if(d.schema>SCHEMA) return toast('Fichier trop récent pour cette version');
    const nom=((d.profil&&d.profil.nom)||'Import')+' (importé)';
    const id=idNeuf();
    registre.liste.push({id, nom:nom.slice(0,24), cree:Date.now(), vue:Date.now()});
    ecritJSON(cleEtat(id), normaliser(d.etat));
    ecritJSON(PROFILS_CLE, registre);
    basculerProfil(id);
  };
  fr.readAsText(fichier);
}

const creaturesDe=site=>CREATURES.filter(c=>c.site===site);
/* Le bonus d'achèvement suit le coût du site : ouvrir Ouadi al-Hitan coûte
   près de dix fois Burgess, le rendre ne peut pas rapporter autant. Le plancher
   garde les premiers sites généreux. */
const bonusDe=id=>{const s=SITES.find(x=>x.id===id);
  return s?Math.max(BONUS_SITE,Math.round(s.cout*BONUS_PART)):BONUS_SITE;};
const possede=id=>(etat.collection[id]||0)>0;
const fragments=id=>etat.collection[id]||0;
const ouvert=id=>!!etat.sitesOuverts[id];
function niveauDoc(id){
  const f=fragments(id); if(f<=0)return 0;
  let n=1; for(let i=1;i<SEUILS_DOC.length;i++) if(f-1>=SEUILS_DOC[i]) n=i+1;
  return n;
}
const siteComplet=s=>creaturesDe(s).every(c=>possede(c.id));
const nbTrouvees=s=>creaturesDe(s).filter(c=>possede(c.id)).length;
const trouvees=()=>CREATURES.filter(c=>possede(c.id));

function majSolde(anim){
  $('#solde-nb').textContent=etat.credits;
  if(anim){const s=$('#solde'); s.classList.remove('pulse'); void s.offsetWidth; s.classList.add('pulse');}
  const b=$('#btn-fouiller');
  if(b) b.disabled=etat.credits<COUT_FOUILLE;
}
function crediter(n){
  n=Math.max(0,Math.round(n)); if(!n)return 0;
  etat.credits+=n; majSolde(true); gainAnim(n); return n;
}

/* ---------------- 3. Navigation et fonds illustrés ---------------- */
/* Aucun écran ne reste nu : le fond global reprend une illustration déjà
   découverte, ou à défaut une vue satellite de site. */
function imageDeFond(){
  const t=trouvees();
  return t.length ? pioche(t).img : pioche(SITES).fond;
}
/* Le fond change à chaque nouvelle question : sur une mission de six exercices,
   cela fait défiler six créatures déjà trouvées. */
function fondDefi(){ majFondGlobal(); }
/* Le voile doit rendre le texte lisible, pas cacher l'illustration. Les panneaux
   de question et de pack sont opaques : le fond n'a donc à porter que les marges,
   et peut rester nettement visible. */
const VOILE='linear-gradient(180deg,rgba(10,15,26,.30) 0%,rgba(10,15,26,.50) 45%,rgba(10,15,26,.78) 100%)';
function majFondGlobal(){
  const el=$('#fond-global'); if(!el)return;
  setFondImg(el, imageDeFond(), VOILE);
}
function montrer(ecran){
  $$('.ecran').forEach(e=>e.classList.toggle('actif', e.id==='ecran-'+ecran));
  $$('nav.tabs button').forEach(b=>b.classList.toggle('on', b.dataset.ecran===ecran));
  /* Revenir à l'onglet Fouille depuis un autre onglet doit rendre l'écran qu'on
     avait quitté. Repartir de la carte du monde oblige à refaire tout le chemin
     et donne l'impression d'avoir perdu sa place. */
  if(ecran==='fouille'){
    if(!siteActif) vueCarte();
    requestAnimationFrame(()=>{ if(pzMonde && $('#vue-carte').style.display!=='none') pzMonde.refit(); });
  }
  if(ecran==='collection'){ majFondGlobal(); rendreCollection(); }
  if(ecran==='bourse'){ majFondGlobal(); menuPacks(); }
}

/* ---------------- 4. Fouille ---------------- */
/* Carte à deux vitesses. La version fine fait 6 140 px de large et 1,3 Mo : la
   charger d'emblée retarde l'affichage de plusieurs secondes sur un réseau lent,
   et l'on croit que rien ne se passe. On affiche donc une version 1 535 px de
   175 Ko, immédiate, puis on substitue la fine une fois qu'elle est arrivée —
   sans que rien ne bouge à l'écran, puisque le viewBox est le même. */
function chargerCarteFine(){
  const el=document.getElementById('img-monde');
  if(!el || el.dataset.fine) return;
  const im=new Image();
  im.onload=()=>{
    el.setAttribute('href','monde.webp');
    el.setAttribute('xlink:href','monde.webp');
    el.dataset.fine='1';
  };
  im.src='monde.webp';
}

/* 4a. Carte du monde : pan/zoom sur le viewBox SVG.
   Le clic ne peut PAS être écouté sur l'épingle elle-même :
   setPointerCapture() sur le <svg> redirige aussi l'événement « click »
   vers le <svg>, si bien qu'un écouteur posé sur le <g> ne part jamais.
   On mémorise donc la cible du pointerdown et on déclenche le tap
   nous-mêmes au pointerup, à condition que le doigt n'ait pas glissé. */
let pzMonde=null;
function zsc(svg){
  const vb=svg.viewBox.baseVal;
  const k=svg.clientWidth>0 ? vb.width/svg.clientWidth : 1;
  svg.querySelectorAll('.zsc').forEach(g=>
    g.setAttribute('transform','translate('+g.dataset.x+','+g.dataset.y+') scale('+k+')'));
}
function panzoom(svg,opt){
  const vb=svg.viewBox.baseVal;
  function aspect(){const a=svg.clientWidth>0?svg.clientHeight/svg.clientWidth:1;return (isFinite(a)&&a>0)?a:0.667;}
  function fitH(){vb.height=vb.width*aspect();}
  /* La carte doit toujours remplir l'écran. Sur un téléphone, un viewBox large
     de 1 535 px devient haut de 2 800 px : on voit alors du vide au-dessus et
     au-dessous de la carte, ce qui casse l'immersion. On borne donc le zoom
     arrière à la hauteur de la carte plutôt qu'à sa largeur, et la borne se
     recalcule à chaque rotation d'écran. */
  function maxWDyn(){
    const b=opt.bounds;
    return Math.max(opt.minW, Math.min(opt.maxW, b.h/Math.max(aspect(),1e-3)));
  }
  const clampW=w=>Math.min(maxWDyn(),Math.max(opt.minW,w));
  function clampPan(){
    const b=opt.bounds;
    vb.x = vb.width>=b.w ? b.x+(b.w-vb.width)/2 : Math.min(b.x+b.w-vb.width, Math.max(b.x, vb.x));
    vb.y = vb.height>=b.h ? b.y+(b.h-vb.height)/2 : Math.min(b.y+b.h-vb.height, Math.max(b.y, vb.y));
  }
  const toVB=(cx,cy)=>{const r=svg.getBoundingClientRect();
    return {x:vb.x+(cx-r.left)/r.width*vb.width, y:vb.y+(cy-r.top)/r.height*vb.height};};
  function upd(){clampPan(); if(opt.onVue) opt.onVue(); zsc(svg);}
  function zoomAt(f,cx,cy){
    const p=toVB(cx,cy); const nw=clampW(vb.width*f); const g=nw/vb.width;
    vb.x=p.x-(p.x-vb.x)*g; vb.y=p.y-(p.y-vb.y)*g; vb.width=nw; fitH(); upd();
  }
  function refit(){vb.width=clampW(vb.width); fitH(); upd();}
  /* Cadrer une région : sert à ouvrir une grappe d'épingles trop serrées. */
  function cadrer(b,marge){
    const m=(marge==null?70:marge);
    const w=Math.max(b.w+2*m, (b.h+2*m)/Math.max(aspect(),1e-3));
    vb.width=clampW(w); fitH();
    vb.x=b.x+b.w/2-vb.width/2; vb.y=b.y+b.h/2-vb.height/2;
    upd();
  }
  refit();
  svg.addEventListener('wheel',e=>{e.preventDefault(); zoomAt(e.deltaY>0?1.14:.88, e.clientX, e.clientY);},{passive:false});

  const pts=new Map(); let last=null, pinch=0, bouge=0, cible=null;
  svg.addEventListener('pointerdown',e=>{
    const n = (e.target&&e.target.closest) ? e.target.closest(opt.tapSel||'.pin') : null;
    cible = n ? {site:n.dataset.site, sites:n.dataset.sites} : null;
    try{ svg.setPointerCapture(e.pointerId); }catch(_){}
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    last={x:e.clientX,y:e.clientY}; bouge=0;
  });
  svg.addEventListener('pointermove',e=>{
    if(!pts.has(e.pointerId))return;
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const a=[...pts.values()];
    if(a.length>=2){
      const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      const mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2;
      if(pinch) zoomAt(pinch/d,mx,my);
      pinch=d; last=null; bouge=999; return;
    }
    if(last){
      const r=svg.getBoundingClientRect();
      bouge+=Math.abs(e.clientX-last.x)+Math.abs(e.clientY-last.y);
      vb.x-=(e.clientX-last.x)/r.width*vb.width;
      vb.y-=(e.clientY-last.y)/r.height*vb.height;
      last={x:e.clientX,y:e.clientY}; upd();
    }
  });
  svg.addEventListener('pointerup',e=>{
    pts.delete(e.pointerId);
    if(pts.size<2) pinch=0;
    last = pts.size===1 ? {x:[...pts.values()][0].x, y:[...pts.values()][0].y} : null;
    if(pts.size===0){
      if(cible && bouge<=8 && opt.onTap) opt.onTap(cible);
      cible=null;
    }
  });
  svg.addEventListener('pointercancel',e=>{pts.delete(e.pointerId); cible=null; pinch=0; last=null;});
  return {refit, zoomAt, cadrer};
}

/* Bernissart et Bundenbach sont séparés de dix-sept pixels sur cette carte :
   aucune position ne les rendra distincts au zoom faible. Les épingles trop
   proches à l'écran sont donc fusionnées en une grappe, qui s'ouvre au tap. */
function grappes(){
  /* Avant la première mise en page — et sous le DOM bouché du harness — le
     viewBox n'est pas lisible : on rend alors une épingle par site. */
  const svg=$('#svg-monde');
  const vb=(svg && svg.viewBox && svg.viewBox.baseVal) || null;
  if(!vb || typeof vb.width!=='number' || !(vb.width>0)) return SITES.map(s=>[s]);
  const larg=(typeof svg.clientWidth==='number' && svg.clientWidth>0)
    ? svg.clientWidth : CARTE_LARGEUR_MIN;
  const seuil=CARTE_GROUPE*(vb.width/larg);   // seuil converti en pixels de carte
  const reste=SITES.slice(), out=[];
  while(reste.length){
    const g=[reste.shift()];
    for(let encore=true; encore;){
      encore=false;
      for(let i=reste.length-1;i>=0;i--)
        if(g.some(s=>Math.hypot(s.x-reste[i].x,s.y-reste[i].y)<seuil)){
          g.push(reste.splice(i,1)[0]); encore=true;
        }
    }
    out.push(g);
  }
  return out;
}
function boiteDe(g){
  const xs=g.map(s=>s.x), ys=g.map(s=>s.y);
  const x=Math.min(...xs), y=Math.min(...ys);
  return {x, y, w:Math.max(...xs)-x, h:Math.max(...ys)-y};
}
function ouvrirGrappe(ids){
  const g=ids.split(',').map(id=>SITES.find(s=>s.id===id)).filter(Boolean);
  if(!g.length||!pzMonde)return;
  pzMonde.cadrer(boiteDe(g));
}
function marqueurSite(s){
  const n=nbTrouvees(s.id), tot=creaturesDe(s.id).length;
  const ouv=ouvert(s.id), fini=ouv&&n>=tot;
  const sous = ouv ? n+'/'+tot : s.cout+' \u25C8';
  return `<g class="zsc pin${fini?' fini':''}${ouv?'':' verrouille'}" data-x="${s.x}" data-y="${s.y}"
            data-site="${s.id}" tabindex="0" role="button" aria-label="${esc(s.nom)}">
    <circle class="pin-halo" r="26"/>
    <circle class="pin-core" r="13"/>
    ${ouv?'<circle class="pin-shine" cx="-4" cy="-4" r="3.5"/>'
         :'<path class="pin-cadenas" d="M-4,-1 h8 v6 h-8 z M-2.4,-1 v-2.6 a2.4,2.4 0 0 1 4.8,0 v2.6"/>'}
    ${fini?'<path class="pin-sceau" d="M-6,0 L-2,4.5 L6.5,-4.5"/>':''}
    <text class="pin-lbl" y="34">${esc(s.court)}</text>
    <text class="pin-sub" y="48">${esc(sous)}</text></g>`;
}
function marqueurGrappe(g){
  const b=boiteDe(g), cx=Math.round(b.x+b.w/2), cy=Math.round(b.y+b.h/2);
  const ouverts=g.filter(s=>ouvert(s.id)).length;
  return `<g class="zsc grappe" data-x="${cx}" data-y="${cy}"
            data-sites="${g.map(s=>s.id).join(',')}" tabindex="0" role="button"
            aria-label="${g.length} chantiers : ${esc(g.map(s=>s.court).join(', '))}">
    <circle class="pin-halo" r="30"/>
    <circle class="grappe-core" r="17"/>
    <text class="grappe-nb" y="6">${g.length}</text>
    <text class="pin-lbl" y="38">${g.length} chantiers</text>
    <text class="pin-sub" y="52">${ouverts?ouverts+' ouvert'+(ouverts>1?'s':''):'zoomer pour ouvrir'}</text></g>`;
}
let signature='';
function construireCarte(force){
  const cible=$('#pins'); if(!cible)return;
  const gs=grappes();
  /* Le rendu tourne à chaque image pendant un déplacement : on ne reconstruit
     que si la composition des grappes ou l'état des sites a changé. */
  const sig=gs.map(g=>g.map(s=>s.id+(ouvert(s.id)?'o':'')+nbTrouvees(s.id)).join('+')).join('|');
  if(!force && sig===signature) return;
  signature=sig;
  cible.innerHTML=gs.map(g=>g.length===1?marqueurSite(g[0]):marqueurGrappe(g)).join('');
  cible.querySelectorAll('[tabindex]').forEach(p=>
    p.addEventListener('keydown',e=>{
      if(e.key!=='Enter'&&e.key!==' ')return;
      e.preventDefault();
      if(p.dataset.sites) ouvrirGrappe(p.dataset.sites); else ouvrirSite(p.dataset.site);
    }));
}

/* 4b. Aiguillage : verrouillé → déblocage ; jamais lu → introduction ; sinon chantier. */
let siteActif=null;
function vueCarte(){
  siteActif=null;
  clearInterval(fondTimer); fondTimer=null;
  $('#vue-carte').style.display='';
  $('#vue-chantier').style.display='none';
  $$('#col-tri button').forEach(b=>b.addEventListener('click',()=>changerTri(b.dataset.tri)));
  construireCarte(true);
  if(pzMonde) requestAnimationFrame(()=>pzMonde.refit());
}
function ouvrirSite(id){
  const s=SITES.find(x=>x.id===id); if(!s)return;
  if(!ouvert(id)) return panneauDeblocage(s);
  if(!etat.introVue[id]) return introSite(id);
  chantier(id);
}
function panneauDeblocage(s){
  const assez=etat.credits>=s.cout;
  $('#modal-corps').innerHTML=`
    <div class="md-vue" id="md-vue"></div>
    <div class="md-txt">
      <p class="md-sur">Chantier non ouvert</p>
      <h2>${esc(s.nom)}</h2>
      <p class="md-meta">${esc(s.region)} · ${esc(s.pays)}<br>${esc(s.ere)} — ${esc(s.age)}</p>
      <p class="md-corps">Ouvrir un chantier engage des frais : autorisations, logistique, campagne de terrain. Le coût est unique, le site reste ensuite accessible.</p>
      <div class="md-cout${assez?'':' court'}">${s.cout} \u25C8
        <span>${assez?'disponible : '+etat.credits+' \u25C8':'il te manque '+(s.cout-etat.credits)+' \u25C8'}</span></div>
      <button class="btn-primaire" ${assez?`onclick="debloquer('${s.id}')"`:'disabled'}>Ouvrir le chantier</button>
      <button class="btn-fant" onclick="fermerModal()">Plus tard</button>
      ${assez?'':'<p class="md-aide">Les missions de la Bourse rapportent des crédits de recherche.</p>'}
    </div>`;
  setFondImg($('#md-vue'), s.fond, 'linear-gradient(180deg,rgba(10,15,26,.2),rgba(17,24,38,.96))');
  /* La même vue sert de fond à l'introduction, juste après. La demander ici la
     met en cache pendant que la personne lit la fenêtre : au moment d'appuyer,
     elle est déjà là, et le bouton ne paraît plus inerte. */
  new Image().src=s.fond;
  $('#modal').classList.add('on');
}
function fermerModal(){ $('#modal').classList.remove('on'); }
function debloquer(id){
  const s=SITES.find(x=>x.id===id);
  if(ouvert(id)) return chantier(id);
  if(etat.credits<s.cout) return toast('Crédits insuffisants');
  etat.credits-=s.cout; etat.sitesOuverts[id]=true; sauver(); majSolde(true);
  fermerModal(); construireCarte(true); introSite(id);
}

/* 4c. Introduction théorique : la vue satellite du site sert de fond. */
let introI=0, introSiteId=null, introRelecture=false;
function introSite(id,relecture){
  introSiteId=id; introI=0; introRelecture=!!relecture;
  const s=SITES.find(x=>x.id===id);
  /* Le voile ne doit assombrir que ce qui porte du texte. Il partait de 30 % pour
     finir à 98 % : la vue satellite disparaissait dans sa moitié basse. */
  setFondImg($('#intro-fond'), s.fond,
    'linear-gradient(180deg,rgba(6,10,18,.12) 0%,rgba(6,10,18,.34) 40%,rgba(6,10,18,.86) 100%)');
  /* Chaque vue satellite porte, en bas à droite, un petit globe qui situe le
     continent sur la Terre d'aujourd'hui. Cadré en `cover` sur un écran de
     téléphone, ce coin était rogné ; recouvert par le bloc de texte, il
     disparaissait. Il est donc extrait en pastille (tools/globes.py) et posé
     au-dessus de tout, en haut à droite, là où rien ne le masque. */
  const g=$('#intro-globe-img');
  if(g){ g.src='globes/'+s.id+'.webp'; g.alt='Position de '+s.court+' sur le globe actuel'; }
  $('#intro-accroche').textContent=s.accroche;
  $('#intro-titre').textContent=s.nom;
  afficheIntro();
  $('#intro').classList.add('on');
}
function afficheIntro(){
  const s=SITES.find(x=>x.id===introSiteId);
  $('#intro-txt').textContent=s.intro[introI];
  $('#intro-dots').innerHTML=s.intro.map((_,i)=>`<span class="${i===introI?'on':''}"></span>`).join('');
  $('#intro-next').textContent = introI===s.intro.length-1 ? 'Descendre sur le chantier →' : 'Continuer ›';
}
function introSuivant(){
  const s=SITES.find(x=>x.id===introSiteId);
  introI++;
  if(introI>=s.intro.length){
    $('#intro').classList.remove('on');
    if(!introRelecture){ etat.introVue[introSiteId]=true; sauver(); }
    const id=introSiteId; introSiteId=null; chantier(id); return;
  }
  afficheIntro();
}

/* 4d. Chantier : plein écran, fond tournant sur les créatures déjà sorties
   de la roche, un seul bouton. */
let fondTimer=null, fondI=0;
function fondsDuSite(s){
  const t=creaturesDe(s).filter(c=>possede(c.id)).map(c=>c.img);
  return t.length ? t : [SITES.find(x=>x.id===s).fond];
}
function rotationFond(){
  if(!siteActif)return;
  const l=fondsDuSite(siteActif);
  fondI=(fondI+1)%l.length;
  setFondImg($('#chantier-fond'), l[fondI],
    'linear-gradient(180deg,rgba(8,12,20,.58) 0%,rgba(8,12,20,.78) 44%,rgba(8,12,20,.97) 100%)');
}
function chantier(id){
  siteActif=id;
  const s=SITES.find(x=>x.id===id);
  const n=nbTrouvees(id), tot=creaturesDe(id).length;
  $('#vue-carte').style.display='none';
  $('#vue-chantier').style.display='';
  fondI=-1; rotationFond();
  clearInterval(fondTimer); fondTimer=setInterval(rotationFond,6000);
  $('#ch-nom').textContent=s.nom;
  $('#ch-meta').textContent=s.region+' · '+s.ere;
  $('#ch-jauge').innerHTML=`<div class="jauge"><i style="width:${n/tot*100}%"></i></div>`;
  $('#ch-avance').textContent=n+' / '+tot+' créatures identifiées';
  /* Les sites n'ont plus tous six créatures : Yixian en compte huit. Au-delà
     de six, on répartit sur deux rangées plutôt que d'en laisser une dépareillée. */
  const cs=creaturesDe(id);
  $('#ch-vignettes').style.gridTemplateColumns=
    'repeat('+(cs.length<=6?cs.length:Math.ceil(cs.length/2))+',1fr)';
  /* Une case vide ne dit pas si elle est vide parce qu'il n'y a rien à trouver
     ou parce qu'on n'a pas encore trouvé. On l'écrit, comme dans la collection. */
  $('#ch-vignettes').innerHTML=cs.map(c=>{
    const ok=possede(c.id);
    return `<button class="vig${ok?'':' verrou'}" ${ok?`onclick="ouvrirFiche('${c.id}')"`:''}
      title="${ok?esc(c.nom):'Créature non découverte'}">
      ${ok?`<img src="${c.img}" loading="lazy" alt="${esc(c.nom)}">`
          :'<span class="vig-q">?</span><span class="vig-inconnu">Créature non découverte</span>'}</button>`;
  }).join('');
  $('#ch-cout').textContent=COUT_FOUILLE;
  majSolde();
}

/* 4e. Coup de pioche. Le crédit est débité à l'ouverture de la tranchée,
   puis une question du site décide si elle livre quelque chose.
   Deux essais, un indice : l'aide ne prive pas du tirage. */
const NB_ESSAIS=2;
let qFouille=null;
function fouiller(){
  if(!siteActif) return;
  if(etat.credits<COUT_FOUILLE) return toast('Crédits de recherche insuffisants');
  etat.credits-=COUT_FOUILLE; etat.fouilles=(etat.fouilles||0)+1;
  sauver(); majSolde(true);
  poserQuestionSite();
}
/* Répartition volontairement plate : on interroge toujours la question la
   moins vue du site. Sur une cinquantaine de fouilles, chacune des vingt
   questions revient donc deux à trois fois. */
function choisirQuestionSite(site){
  const b=QUIZ_PALEO.filter(q=>q.site===site);
  const c=etat.qSite[site]||(etat.qSite[site]={});
  let min=Infinity; b.forEach(q=>{ const n=c[q.id]||0; if(n<min)min=n; });
  const candidats=b.filter(q=>(c[q.id]||0)===min);
  return candidats[rnd(0,candidats.length-1)];
}
/* Marquer un bouton comme occupé le temps que l'action se déclenche. Sans ce
   retour, une action qui attend une image donne l'impression de n'avoir pas pris. */
function occupe(btn,txt){
  if(!btn)return ()=>{};
  const av=btn.textContent, dis=btn.disabled;
  btn.disabled=true; if(txt) btn.textContent=txt;
  return ()=>{ btn.disabled=dis; btn.textContent=av; };
}

function poserQuestionSite(){
  const q=choisirQuestionSite(siteActif);
  const c=etat.qSite[siteActif];
  c[q.id]=(c[q.id]||0)+1;
  qFouille={q, essais:0, aide:false, choix:melange(q.choix)};
  rendreQuestionFouille();
  $('#tranchee').classList.add('on');
}
function rendreQuestionFouille(){
  const s=SITES.find(x=>x.id===siteActif), q=qFouille.q;
  $('#tranchee-corps').innerHTML=`
    <div class="tr-tete">
      <span class="tr-site">${esc(s.court)}</span>
      <span class="tr-essais" id="tr-essais">essai ${qFouille.essais+1} / ${NB_ESSAIS}</span>
    </div>
    <p class="tr-intro">La tranchée est ouverte. Identifie correctement pour qu'elle livre quelque chose.</p>
    <div class="q-txt">${esc(q.q)}</div>
    <div id="tr-rep" class="q-choix">
      ${qFouille.choix.map(c=>`<button class="rep" onclick="repFouille(this.textContent,this)">${esc(c)}</button>`).join('')}
    </div>
    <button class="btn-indice" id="tr-indice" onclick="indiceFouille()">Réduire le champ des possibles</button>
    <div class="q-fb" id="tr-fb"></div>`;
}
/* Sur un QCM factuel, écarter une mauvaise réponse aide plus qu'une phrase vague. */
function indiceFouille(){
  qFouille.aide=true;
  $('#tr-indice').style.display='none';
  const faux=$$('#tr-rep .rep').filter(b=>!egal(b.textContent,qFouille.q.r)&&!b.disabled);
  if(faux.length>1){ const v=faux[rnd(0,faux.length-1)]; v.disabled=true; v.classList.add('ecarte'); }
  const fb=$('#tr-fb'); fb.className='q-fb indice';
  fb.textContent='💡 Une proposition a été écartée.';
}
function repFouille(val,btn){
  if(!qFouille)return;
  const q=qFouille.q;
  if(egal(val,q.r)){
    btn.classList.add('bon');
    $$('#tr-rep .rep').forEach(b=>b.disabled=true);
    $('#tr-indice').style.display='none';
    const fb=$('#tr-fb'); fb.className='q-fb bon';
    fb.innerHTML=`<b>Juste.</b> ${esc(q.exp)}`
      +(q.src?`<div class="q-src"><a href="${esc(q.src[1])}" target="_blank" rel="noopener">${esc(q.src[0])}</a></div>`:'')
      +`<button class="btn-primaire" onclick="tirage()">Extraire la pièce</button>`;
    return;
  }
  qFouille.essais++;
  btn.classList.add('faux'); btn.disabled=true;
  if(qFouille.essais<NB_ESSAIS){
    const fb=$('#tr-fb'); fb.className='q-fb retry';
    fb.textContent='Pas celle-là. Il te reste un essai.';
    const t=$('#tr-essais'); if(t) t.textContent='essai '+(qFouille.essais+1)+' / '+NB_ESSAIS;
    return;
  }
  $$('#tr-rep .rep').forEach(b=>{ b.disabled=true; if(egal(b.textContent,q.r)) b.classList.add('bon'); });
  $('#tr-indice').style.display='none';
  etat.echecs=(etat.echecs||0)+1; sauver();
  const fb=$('#tr-fb'); fb.className='q-fb faux';
  fb.innerHTML=`<b>Réponse : ${esc(q.r)}.</b> ${esc(q.exp)}`
    +(q.src?`<div class="q-src"><a href="${esc(q.src[1])}" target="_blank" rel="noopener">${esc(q.src[0])}</a></div>`:'')
    +`<button class="btn-primaire" onclick="trancheeSterile()">Refermer la tranchée</button>`;
}
/* Une fouille qui ne rend rien est le seul endroit du jeu où l'on perdait
   quelque chose — et il se trouvait du côté du plaisir. Deux réponses fausses
   sur une question de paléontologie transformaient le refuge en second examen.
   Désormais la tranchée livre toujours un fragment : moins qu'une pièce
   complète, jamais rien. */
function trancheeSterile(){
  qFouille=null;
  $('#tranchee').classList.remove('on');
  const pool=creaturesDe(siteActif).filter(c=>possede(c.id));
  if(pool.length){
    const c=pioche(pool);
    etat.collection[c.id]=fragments(c.id)+1;
    const avant=niveauDoc(c.id), apres=niveauDoc(c.id);
    sauver();
    return revealCarte(c,'fragment',apres,false,
      'La pièce principale est restée dans la roche, mais la tranchée a livré des éclats.');
  }
  $('#reveal-corps').innerHTML=`<div class="rev-vide">
    <div class="rev-vide-ico">⛏️</div>
    <div class="rev-vide-t">La pièce est restée dans la roche</div>
    <div class="rev-vide-s">Ça arrive à tout le monde, et la couche est toujours là. La question reviendra, avec sa réponse en tête cette fois.</div>
    <button class="btn-primaire" onclick="fermerReveal()">Revenir au chantier</button></div>`;
  $('#reveal').classList.add('on');
}
/* Le tirage : les créatures inconnues sont favorisées, les doublons
   deviennent des fragments qui enrichissent un dossier. */
function tirage(){
  qFouille=null;
  $('#tranchee').classList.remove('on');
  if(FOUILLE_VIDE && Math.random()<0.15) return trancheeSterile();
  const pool=creaturesDe(siteActif);
  const poids=pool.map(c=>possede(c.id)?1:3);
  let tot=poids.reduce((a,b)=>a+b,0), t=Math.random()*tot, k=0;
  while(t>poids[k]){ t-=poids[k]; k++; }
  const c=pool[k];
  const avant=niveauDoc(c.id);
  etat.collection[c.id]=fragments(c.id)+1;
  if(!etat.ordre[c.id]) etat.ordre[c.id]=++etat.ordreN;
  const apres=niveauDoc(c.id);
  const complet=siteComplet(siteActif) && !etat.sitesBonus[siteActif];
  if(complet){ etat.sitesBonus[siteActif]=true; etat.credits+=bonusDe(siteActif); }
  sauver(); majSolde(true);
  revealCarte(c, avant===0?'nouvelle':(apres>avant?'dossier':'fragment'), apres, complet);
}
function revealCarte(c,type,niv,bonusSite,note){
  const s=SITES.find(x=>x.id===c.site);
  const bandeau = type==='nouvelle' ? 'Créature inédite'
    : type==='dossier' ? 'Dossier enrichi — niveau '+niv : 'Fragment supplémentaire';
  const reste = niv<3 ? (SEUILS_DOC[niv]+1-fragments(c.id)) : 0;
  const sous = note ? note
    : type==='nouvelle' ? c.groupe
    : type==='dossier' ? 'De nouvelles informations sont lisibles sur la fiche.'
    : (niv<3 ? 'Encore '+reste+' fragment'+(reste>1?'s':'')+' avant le niveau '+(niv+1)
             : 'Dossier déjà complet — la pièce rejoint la réserve.');
  $('#reveal-corps').innerHTML=`
    <div class="rev-flip" id="rev-flip">
      <div class="rev-face rev-dos"><span>⛏️</span></div>
      <div class="rev-face rev-avant"><img src="${c.img}" alt="${esc(c.nom)}"></div>
    </div>
    <div class="rev-etat ${type}">${esc(bandeau)}</div>
    <div class="rev-nom">${esc(c.nom)}</div>
    <div class="rev-sous">${esc(sous)}</div>
    ${bonusSite?`<div class="rev-bonus">🏅 ${esc(s.court)} complété — +${bonusDe(s.id)} \u25C8</div>`:''}
    <button class="btn-primaire" onclick="fermerReveal('${c.id}')">Consulter la fiche</button>
    <button class="btn-fant" onclick="fermerReveal()">Rester sur le chantier</button>`;
  $('#reveal').classList.add('on');
  requestAnimationFrame(()=>setTimeout(()=>{const f=$('#rev-flip'); if(f)f.classList.add('flip');},240));
}
function fermerReveal(voirFiche){
  $('#reveal').classList.remove('on');
  if(voirFiche){ montrer('collection'); ouvrirFiche(voirFiche); }
  else if(siteActif) chantier(siteActif);
}

/* ---------------- 5. Collection et fiches ---------------- */
/* Trois classements des mêmes créatures. Le tri par période est le seul qui
   fasse sentir la durée : il met côte à côte des bêtes qui ne se sont jamais
   croisées mais qui partageaient le même monde, et laisse voir les trous. */
const TRIS={
  chantier:{
    titre:'Par chantier',
    sections:()=>SITES.map(s=>({cle:s.id, titre:s.court, sous:s.ere+' · '+s.age,
                                cs:creaturesDe(s.id)}))
  },
  periode:{
    titre:'Par période',
    sections:()=>PERIODES.map(p=>({cle:p.nom, titre:p.nom, sous:p.ere+' · '+p.de+'–'+p.a+' Ma',
      cs:CREATURES.filter(c=>periodeDe(c).nom===p.nom)
                  .sort((a,b)=>(b.ageMin+b.ageMax)-(a.ageMin+a.ageMax))}))
  },
  groupe:{
    titre:'Par famille',
    sections:()=>GRANDS_GROUPES.map(g=>{
      const cs=CREATURES.filter(c=>grandGroupe(c)===g[0])
                        .sort((a,b)=>(b.ageMin+b.ageMax)-(a.ageMin+a.ageMax));
      return {cle:g[0], titre:g[0], cs,
              sous: cs.length ? 'de '+Math.round(Math.max(...cs.map(c=>c.ageMax)))
                                +' à '+Math.round(Math.min(...cs.map(c=>c.ageMin)))+' Ma' : ''};
    })
  }
};
function vignette(c){
  const ok=possede(c.id), nv=niveauDoc(c.id);
  return `<button class="carte${ok?'':' verrou'}" ${ok?`onclick="ouvrirFiche('${c.id}')"`:''}>
    ${ok?`<img src="${c.img}" loading="lazy" alt="${esc(c.nom)}">
      <span class="c-niv" title="Niveau documentaire">${'●'.repeat(nv)}${'○'.repeat(3-nv)}</span>`
      :`<span class="c-q">?</span><span class="c-inconnu">Non découverte</span>`}
  </button>`;
}
function rendreCollection(){
  const tot=CREATURES.length, n=trouvees().length;
  $('#col-compte').textContent=n+' / '+tot;
  const mode=(etat.tri==='frise'||TRIS[etat.tri])?etat.tri:'chantier';
  $$('#col-tri button').forEach(b=>b.classList.toggle('on', b.dataset.tri===mode));
  if(mode==='frise'){ rendreFrise(); return; }
  $('#col-corps').innerHTML=TRIS[mode].sections()
    .filter(s=>s.cs.length)
    .map(s=>{
      const trouve=s.cs.filter(c=>possede(c.id)).length;
      return `<section class="col-bloc">
        <h3>${esc(s.titre)} <small>${esc(s.sous)}</small>
          <em class="col-part">${trouve} / ${s.cs.length}</em></h3>
        <div class="grille">${s.cs.map(vignette).join('')}</div></section>`;
    }).join('');
}
/* « frise » n'est pas un tri au sens des autres — elle ne range pas les mêmes
   objets — mais elle occupe la même place dans la tête : une manière de
   regarder sa collection. Un onglet de plus aurait alourdi le schéma mental
   pour une vue qu'on ouvre rarement. */
function changerTri(m){ if(m!=='frise' && !TRIS[m])return; etat.tri=m; sauver(); rendreCollection(); }
/* ---- Frise verticale ----
   Le tri « par période » de la collection range les créatures par tranche, mais
   toutes les tranches y ont la même hauteur : on n'y sent pas que le Crétacé
   dure quatre-vingts millions d'années et le Quaternaire deux et demi.

   Ici l'échelle est LINÉAIRE et l'axe est vertical, pensé pour un pouce qui
   défile. Trois décisions en découlent.

   1. La frise porte les CHANTIERS, pas les créatures une à une. Les douze bêtes
      du Hunsrück ont le même âge : les empiler verticalement serait faux, les
      étaler latéralement demanderait quatorze colonnes. Un gisement est un
      instant, et c'est ce que la frise montre.

   2. Deux chantiers trop proches dans le temps se décalent LATÉRALEMENT, jamais
      verticalement — Nemegt et Hell Creek sont séparés de deux millions
      d'années, soit dix-huit pixels : ils sont bel et bien contemporains, et la
      frise doit le dire. Même principe que les grappes d'épingles de la carte.

   3. Les quatre milliards d'années d'avant l'Édiacarien ne tiennent pas à cette
      échelle. Plutôt que de les compresser en silence, on les annonce : à huit
      pixels par million d'années, il faudrait trente et un mètres de haut. */
const FRISE_DEBUT=650;          // en Ma ; l'Édiacarien commence à 635
const FRISE_PX_PAR_MA=8;        // hauteur ≈ 5 200 px
const FRISE_ECART_MIN=46;       // en deçà, deux chantiers se décalent de côté
function yFrise(ma){ return (FRISE_DEBUT-ma)*FRISE_PX_PAR_MA; }
function ageMoyenSite(id){
  const cs=CREATURES.filter(c=>c.site===id);
  return cs.reduce((a,c)=>a+(c.ageMin+c.ageMax)/2,0)/cs.length;
}
let friseOuvert=null;

function rendreFrise(){
  const H=yFrise(0)+30;

  const eres=[{nom:'Protérozoïque',de:650,a:538.8},{nom:'Paléozoïque',de:538.8,a:251.9},
              {nom:'Mésozoïque',de:251.9,a:66},{nom:'Cénozoïque',de:66,a:0}];
  const bandes=eres.map((e,i)=>`<div class="fri-ere e${i}"
      style="top:${yFrise(e.de)}px;height:${yFrise(e.a)-yFrise(e.de)}px">
      <span>${esc(e.nom)}</span></div>`).join('');

  const grads=PERIODES.filter(p=>p.de<=FRISE_DEBUT).map(p=>
    `<div class="fri-per" style="top:${yFrise(p.de)}px"><b>${esc(p.nom)}</b><i>${p.de} Ma</i></div>`).join('');

  const rangs=SITES.map(s=>({s, y:yFrise(ageMoyenSite(s.id))})).sort((a,b)=>a.y-b.y);
  const occ=[];
  const marqueurs=rangs.map(({s,y})=>{
    let col=0;
    while(occ[col]!==undefined && y-occ[col]<FRISE_ECART_MIN) col++;
    occ[col]=y;
    const cs=creaturesDe(s.id), n=cs.filter(c=>possede(c.id)).length;
    const ouvert=friseOuvert===s.id;
    return `<div class="fri-site${ouvert?' ouvert':''}" style="top:${y}px;margin-left:${col*14}px">
      <button class="fri-tete" onclick="friseBascule('${s.id}')">
        <img class="fri-globe" src="globes/${s.id}.webp" alt="" loading="lazy">
        <span class="fri-nom">${esc(s.court)}</span>
        <span class="fri-cpt">${n} / ${cs.length}</span>
      </button>
      ${ouvert?`<div class="fri-bêtes">${cs.map(c=>possede(c.id)
          ? `<button class="fri-b" onclick="ouvrirFiche('${c.id}')" title="${esc(c.nom)}">
               <img src="${c.img}" loading="lazy" alt="${esc(c.nom)}"><em>${esc(c.nom)}</em></button>`
          : `<span class="fri-b verrou"><i>?</i><em>Non découverte</em></span>`).join('')}</div>`:''}
    </div>`;
  }).join('');

  $('#col-corps').innerHTML=`
    <p class="fri-aide">Le temps de haut en bas, à l’échelle : chaque graduation
      vaut le même nombre d’années. Touche un chantier pour déplier ses créatures.</p>
    <div class="fri-avant">
      <b>4,54 milliards d’années avant cette frise</b>
      <span>De la formation de la Terre à l’Édiacarien. À l’échelle utilisée ici,
      cette portion mesurerait trente et un mètres de haut, et ne contiendrait
      presque aucun fossile visible à l’œil nu.</span>
    </div>
    <div class="fri-axe" style="height:${H}px">
      ${bandes}${grads}<div class="fri-ligne"></div>${marqueurs}
    </div>`;
}
function friseBascule(id){
  friseOuvert = friseOuvert===id ? null : id;
  const el=$('#ecran-collection'), av=el?el.scrollTop:0;
  rendreFrise();
  if(el) el.scrollTop=av;
}

/* ---- Réglages ----
   Deux besoins seulement : forcer une mise à jour quand une nouvelle version a
   été livrée mais que le service worker sert encore l'ancienne, et savoir où
   l'on en est. Rien d'autre : un écran d'options est un endroit où l'on se perd. */
/* Le panneau a deux états seulement : la vue courante, et la liste des profils.
   Pas de sous-menus, pas d'onglets — c'est un tiroir, pas un tableau de bord. */
let vueReglages='profil';

function ouvrirReglages(v){
  if(v) vueReglages=v;
  const p=profilActif()||{nom:'Profil'};
  const n=trouvees().length, ch=SITES.filter(s=>etat.sitesOuverts[s.id]).length;
  let html;

  if(vueReglages==='maj'){
    html=`<p class="md-sur">Mise à jour</p>
      <h3>Voulez-vous forcer la mise à jour&nbsp;?</h3>
      <p class="rg-note">À faire seulement si une nouvelle version a été installée
        mais que l’application affiche encore l’ancienne. Aucune progression n’est
        touchée : les profils sont enregistrés séparément des fichiers de
        l’application.</p>
      <button class="btn-primaire" onclick="forcerMaj(this)">Oui, mettre à jour</button>
      <button class="btn-fant" onclick="ouvrirReglages('profil')">Annuler</button>`;
  }else{
    html=`<p class="md-sur">Profil</p>
      <h3>${esc(p.nom)}</h3>
      <p class="rg-ligne"><span>Créatures</span><b>${n} / ${CREATURES.length}</b></p>
      <p class="rg-ligne"><span>Chantiers ouverts</span><b>${ch} / ${SITES.length}</b></p>
      <p class="rg-ligne"><span>Crédits</span><b>${etat.credits} \u25C8</b></p>
      <p class="rg-ligne"><span>Version</span><b>${esc(VERSION_APP)}</b></p>
      <div class="rg-actions">
        <button class="btn-fant" onclick="fermerReglages(); ouvrirChoixProfil()">Changer de partie</button>
        <button class="btn-fant" onclick="renommerActif()">Renommer</button>
        <button class="btn-fant" onclick="exporterProgression()">Exporter la progression</button>
        <button class="btn-fant" onclick="choisirFichierImport()">Importer un fichier</button>
        ${registre.liste.length>1?`<button class="btn-fant rg-danger" onclick="supprimerActif()">Supprimer ce profil</button>`:''}
        <button class="btn-fant" onclick="ouvrirReglages('maj')">Forcer la mise à jour</button>
      </div>
      <p class="rg-note">L’export produit un fichier que tu peux conserver ou
        transférer sur un autre appareil. Un import crée toujours un nouveau profil,
        pour qu’aucune progression existante ne soit écrasée.</p>
      <button class="btn-primaire" onclick="fermerReglages()">Fermer</button>`;
  }
  $('#reglages-corps').innerHTML=html;
  $('#reglages').classList.add('on');
}
function fermerReglages(){ vueReglages='profil'; $('#reglages').classList.remove('on'); }

/* Rappeler le profil courant dans le bandeau. Appelé à chaque bascule et au
   démarrage : c'est la seule chose à l'écran qui distingue deux progressions. */
/* ---------- Choix du profil ----------
   Aucun mot de passe : tout est local, et le seul risque n'est pas l'intrusion
   mais la méprise — jouer une heure sur la partie de quelqu'un d'autre. L'écran
   ne s'affiche donc que s'il y a réellement un choix à faire. */

/* Résumé d'un profil sans le charger : on lit sa clé d'état directement. */
function apercuProfil(id){
  const e=normaliser(litJSON(cleEtat(id))||etatVide());
  const trouvees=Object.keys(e.collection||{}).filter(k=>e.collection[k]>0);
  /* La vignette est la DERNIÈRE créature déterrée : on reconnaît sa partie à ce
     qu'on y a trouvé, ce qui évite d'avoir à choisir une image. */
  let derniere=null, rang=-1;
  trouvees.forEach(k=>{ const r=(e.ordre||{})[k]||0; if(r>rang){rang=r; derniere=k;} });
  const c=derniere?CREATURES.find(x=>x.id===derniere):null;
  return {n:trouvees.length, creature:c};
}

function ouvrirChoixProfil(){
  $('#cp-corps').innerHTML=`
    <p class="cp-sur">Atlas du temps profond</p>
    <h2 class="cp-titre">Qui joue&nbsp;?</h2>
    <div class="cp-grille">
      ${registre.liste.map(p=>{
        const a=apercuProfil(p.id);
        return `<button class="cp-tuile${p.id===registre.actif?' actif':''}"
          onclick="entrerProfil('${p.id}')">
          <span class="cp-vig">${a.creature
            ? `<img src="${a.creature.img}" loading="lazy" alt="">`
            : '<span class="cp-vide">\u25C8</span>'}</span>
          <span class="cp-nom">${esc(p.nom)}</span>
          <span class="cp-compte">${a.n} / ${CREATURES.length} créatures</span>
        </button>`;
      }).join('')}
      <button class="cp-tuile cp-neuf" onclick="profilDepuisChoix()">
        ＋<br>Nouvelle partie</button>
    </div>`;
  $('#choix-profil').classList.add('on');
}
function fermerChoixProfil(){ $('#choix-profil').classList.remove('on'); }

/* Entrer dans un profil depuis l'écran de choix : si c'est déjà l'actif, il n'y
   a rien à basculer, seulement l'écran à refermer. */
function entrerProfil(id){
  fermerChoixProfil();
  if(id===registre.actif){
    if(besoinAccueil()) ouvrirAccueil();
    return;
  }
  basculerProfil(id);
}

function profilDepuisChoix(){ fermerChoixProfil(); creerProfil(''); }

/* ---------- Accueil et guide ----------
   Un profil neuf commence par un écran qui le nomme et par trois lignes
   d'explication. Ensuite, plus jamais : `etat.accueilVu` le retient.
   Un profil qui a déjà de la progression n'y passe pas — il a été migré
   d'une version antérieure et sait déjà à quoi il joue. */
function besoinAccueil(){
  return !etat.accueilVu && trouvees().length===0;
}

function ouvrirAccueil(){
  const c=CREATURES.find(x=>x.id===CREATURE_ACCUEIL)||CREATURES[0];
  const el=$('#acc-fond');
  if(el && c) el.style.backgroundImage='url("'+c.img+'")';
  const cr=$('#acc-credit');
  if(cr && c) cr.textContent=c.nom+' \u2014 '+c.periode;
  const nom=$('#acc-nom');
  if(nom){
    const p=profilActif();
    /* On ne pré-remplit pas « Profil 1 » : un champ occupé n'invite pas à écrire. */
    nom.value=(p && !/^Profil \d+$/.test(p.nom)) ? p.nom : '';
    nom.addEventListener('keydown',e=>{ if(e.key==='Enter') validerAccueil(); });
  }
  $('#accueil').classList.add('on');
  setTimeout(()=>{ if(nom) nom.focus(); },420);
}

function validerAccueil(){
  const nom=$('#acc-nom');
  const v=(nom?nom.value:'').trim().slice(0,24);
  const p=profilActif();
  if(p && v){ p.nom=v; ecritJSON(PROFILS_CLE, registre); majNomProfil(); }
  etat.accueilVu=true; sauver();
  $('#accueil').classList.remove('on');
  ouvrirGuide();
}

function ouvrirGuide(){
  $('#guide-corps').innerHTML=`
    <p class="md-sur">Comment ça marche</p>
    <h3>Trois écrans, un seul but</h3>
    <div class="gd-ligne"><span class="gd-ico">🎓</span>
      <p class="gd-txt"><b>Bourse.</b> Tu réponds à des questions et tu gagnes
        des crédits de recherche. C’est ce qui finance les fouilles.</p></div>
    <div class="gd-ligne"><span class="gd-ico">⛏️</span>
      <p class="gd-txt"><b>Fouille.</b> Tu ouvres un chantier sur la carte du monde,
        puis tu creuses : chaque bonne réponse sur le site dégage une créature.</p></div>
    <div class="gd-ligne"><span class="gd-ico">🧬</span>
      <p class="gd-txt"><b>Collection.</b> Tout ce que tu as trouvé, à classer par
        chantier, par période, par famille, ou à voir sur la frise du temps.</p></div>
    <div class="gd-but"><b>Le but</b>
      Fouiller les ${SITES.length} chantiers du monde et reconstituer l’histoire du
      vivant, des premiers organismes d’il y a 560 millions d’années jusqu’à hier.</div>
    <button class="btn-primaire" onclick="fermerGuide()">Commencer à fouiller</button>`;
  $('#guide').classList.add('on');
}
function fermerGuide(){ $('#guide').classList.remove('on'); }

function choisirFichierImport(){
  const el=document.getElementById('fichier-import');
  if(el) el.click(); else toast('Import indisponible');
}

function majNomProfil(){
  const el=$('#btn-profil-nom'), p=profilActif();
  if(el) el.textContent=(p&&p.nom)||'Profil';
}

/* Saisie de texte : l'application n'a aucun champ ailleurs, on garde donc le
   dialogue natif plutôt que d'inventer un clavier maison. */
/* On ne demande pas le nom ici : le profil neuf part sur l'écran d'accueil,
   qui le demande dans son propre décor. Un dialogue de moins. */
function nouveauProfil(){ creerProfil(''); }
function renommerActif(){
  const p=profilActif(); if(!p) return;
  const n=prompt('Nouveau nom ?',p.nom);
  if(n!==null) renommerProfil(p.id,n);
}
function supprimerActif(){
  const p=profilActif(); if(!p) return;
  if(confirm('Supprimer le profil « '+p.nom+' » et toute sa progression ?\n\nCette action est définitive.'))
    supprimerProfil(p.id);
}

/* Vider les caches du service worker puis recharger. La progression vit dans
   localStorage, que l'on ne touche pas. */
async function forcerMaj(btn){
  if(btn){ btn.disabled=true; btn.textContent='Mise à jour…'; }
  try{
    if('caches' in window){
      const noms=await caches.keys();
      await Promise.all(noms.map(n=>caches.delete(n)));
    }
    if('serviceWorker' in navigator){
      const rs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(rs.map(r=>r.unregister()));
    }
  }catch(e){ /* on recharge quand même : au pire rien n'a été vidé */ }
  location.reload(true);
}

function ouvrirFiche(id){
  const c=CREATURES.find(x=>x.id===id); if(!c)return;
  const nv=niveauDoc(id), s=SITES.find(x=>x.id===c.site), f=fragments(id);
  const prochain = nv<3 ? SEUILS_DOC[nv]+1-f : 0;
  let h=`<img class="fi-img" src="${c.img}" alt="${esc(c.nom)}">
    <div class="fi-corps">
      <div class="fi-niv">${'●'.repeat(nv)}${'○'.repeat(3-nv)} <span>Niveau documentaire ${nv} / 3</span></div>
      <h2>${esc(c.nom)}</h2>
      <p class="fi-groupe">${esc(c.groupe)}</p>
      <dl class="fi-dl">
        <dt>Période</dt><dd>${esc(c.periode)} — ${esc(c.age)}</dd>
        <dt>Découvert en</dt><dd>${esc(c.lieu)}</dd>
        <dt>Site</dt><dd>${esc(s.nom)}</dd>
      </dl>
      <p class="fi-desc">${esc(c.desc)}</p>`;
  if(nv>=2){
    h+=`<h4>Spécimen documenté</h4>
      <dl class="fi-dl">
        <dt>Milieu</dt><dd>${esc(c.milieu)}</dd>
        <dt>Régime</dt><dd>${esc(c.regime)}</dd>
        <dt>Longueur</dt><dd>${esc(c.taille)}</dd>
        <dt>Masse</dt><dd>${esc(c.masse)}</dd>
      </dl>`;
  } else {
    h+=`<div class="fi-bloque">Niveau 2 verrouillé — encore ${prochain} fragment${prochain>1?'s':''} à extraire.</div>`;
  }
  if(nv>=3){
    h+=`<h4>Dossier reconstitué</h4>
      <p class="fi-prudence"><b>Limites de la reconstruction.</b> ${esc(c.prudence)}</p>
      <dl class="fi-dl">
        <dt>Confiance graphique</dt><dd>${esc(c.conf)} (${c.confN}/5)</dd>
        <dt>Longévité</dt><dd>${esc(c.longevite)}</dd>
        <dt>Fiabilité longévité</dt><dd>${esc(c.confLong)}</dd>
      </dl>
      <h4>Sources</h4>
      <ul class="fi-src">${c.src.filter(x=>x&&x[1]).map(x=>
        `<li><a href="${esc(x[1])}" target="_blank" rel="noopener">${esc(x[0])}</a></li>`).join('')}</ul>`;
  } else if(nv===2){
    h+=`<div class="fi-bloque">Niveau 3 verrouillé — encore ${prochain} fragment${prochain>1?'s':''}. Il contient les limites de la reconstruction et les sources.</div>`;
  }
  h+=`<div class="fi-frag">${f} fragment${f>1?'s':''} extrait${f>1?'s':''}</div></div>`;
  $('#fiche-corps').innerHTML=h;
  $('#fiche').classList.add('on');
}
function fermerFiche(){ $('#fiche').classList.remove('on'); }

/* ---------------- 6. Bourse ---------------- */
const SEUIL_MAITRISE=2;
const bareme=p=>BAREME[p.cat]||BAREME.base;
function prog(id){
  let p=etat.packprog[id];
  if(!p||typeof p.niv!=='number') p=etat.packprog[id]={niv:1,c:{},reussites:0};
  p.c=p.c||{}; p.reussites=p.reussites||0; return p;
}
function packNiv(id){ return Math.min(3,1+Math.floor(prog(id).reussites/18)); }
function bankPack(p){ return p.type==='bank' ? p.bank() : null; }
function statPack(id){ etat.stats[id]=etat.stats[id]||{ok:0,tot:0}; return etat.stats[id]; }
function avancePack(p){
  const b=bankPack(p);
  if(!b) return {txt:'Niveau '+packNiv(p.id)+' · sans fin', pct:Math.min(100,prog(p.id).reussites/54*100)};
  const c=prog(p.id).c; let m=0;
  b.forEach(q=>{ if((c[q.q]||0)>=SEUIL_MAITRISE) m++; });
  return {txt:m+' / '+b.length+' maîtrisées', pct:m/b.length*100};
}
function menuPacks(){
  $('#bourse-corps').innerHTML=`
    <p class="intro-p">Une mission compte ${NB_MISSION} exercices. Les crédits gagnés financent l'ouverture des chantiers et chaque coup de pioche. Une réponse trouvée après l'indice rapporte moins, mais rien n'est jamais retiré.</p>
    <h3 class="grp">Histoire et philosophie <em>${BAREME.histoire.juste} \u25C8 par bonne réponse</em></h3>
    ${PACKS.filter(p=>p.cat==='histoire').map(carteP).join('')}
    <h3 class="grp">Accompagnement scolaire
      <em>secondaire inférieur · ${BAREME.ecole.juste} \u25C8 par bonne réponse</em></h3>
    <p class="grp-note">Ces six packs suivent le programme de 12-15 ans, pour pouvoir
      aider aux devoirs sans être prise de court.</p>
    ${PACKS.filter(p=>p.cat==='ecole').map(carteP).join('')}`;
}
function carteP(p){
  const a=avancePack(p), st=statPack(p.id);
  const taux=st.tot?Math.round(st.ok/st.tot*100)+' %':'—';
  return `<button class="pack" onclick="ouvrirPack('${p.id}')">
    <span class="pk-ico">${p.ico}</span>
    <span class="pk-txt"><b>${esc(p.nom)}</b><small>${esc(p.sous)}</small>
      <span class="jauge sm"><i style="width:${a.pct}%"></i></span>
      <small class="pk-st">${esc(a.txt)} · réussite ${taux}</small></span>
    <span class="pk-go">›</span></button>`;
}
let packActif=null;
function ouvrirPack(id){
  packActif=PACKS.find(p=>p.id===id);
  const p=packActif, a=avancePack(p), b=bareme(p);
  $('#bourse-corps').innerHTML=`
    <div class="pk-tete"><button class="retour" onclick="menuPacks()">←</button>
      <div><b>${p.ico} ${esc(p.nom)}</b><small>${esc(p.sous)}</small></div></div>
    <p class="pk-obj">${esc(p.objectif)}</p>
    <div class="jauge"><i style="width:${a.pct}%"></i></div>
    <p class="pk-st2">${esc(a.txt)} · ${b.juste} \u25C8 par bonne réponse, ${b.mission} \u25C8 à l'arrivée</p>
    <button class="btn-primaire" onclick="lancerMission()">Commencer une mission (${NB_MISSION} exercices)</button>
    <details class="theo"><summary>📖 Rappel théorique</summary><div>${esc(p.theorie).replace(/\n/g,'<br>')}</div></details>`;
}
function genConjugaison(niv){
  const V=verbesNiv(niv);
  const v=V[rnd(0,V.length-1)];
  const dispo=TEMPS.filter(t=>t.niv<=niv);
  const t=dispo[rnd(0,dispo.length-1)];
  const p=rnd(0,5);
  const forme=conjuguer(v,t.id,p);
  const marq = t.id==='subjonctif' ? 'que '+sujetPour(p,forme) : sujetPour(p,forme);
  const exp=`${v} · ${t.nom} · ${PERS_LBL[p]} → ${marq}${forme}.`
    + (VER_IRR[v] ? ' Verbe irrégulier : la forme ne se déduit pas de l’infinitif.' : '');
  if(Math.random()<0.5){
    const set=new Set([forme]); const faux=[];
    for(let i=0;i<6&&faux.length<3;i++){
      const alt = Math.random()<0.5 ? conjuguer(v,t.id,rnd(0,5)) : conjuguer(v,dispo[rnd(0,dispo.length-1)].id,p);
      if(alt&&!set.has(alt)){ set.add(alt); faux.push(alt); }
    }
    let k=0; while(faux.length<3&&k<6){ const alt=conjuguer(v,'imparfait',k); if(!set.has(alt)){set.add(alt);faux.push(alt);} k++; }
    return {q:`« ${v} » — ${PERS_LBL[p]} du ${t.nom}. Quelle forme est correcte ?`,
      r:forme, choix:melange([forme,...faux]), exp,
      indice:'Repère d’abord la terminaison propre à ce temps.'};
  }
  return {q:`Conjugue « ${v} » à la ${PERS_LBL[p]} du ${t.nom}.`,
    sujet:marq, r:forme, exp, indice:'Écris seulement la forme verbale ; le sujet est déjà donné.'};
}
function genMaths(niv){
  const dispo=GEN_MATHS.filter(g=>g.niv<=niv);
  return dispo[rnd(0,dispo.length-1)].gen(niv);
}
function choisirBanque(p){
  const b=bankPack(p), c=prog(p.id).c, pond=[];
  b.forEach(q=>{ const n=c[q.q]||0; if(n>=SEUIL_MAITRISE)return;
    for(let i=0;i<SEUIL_MAITRISE-n;i++) pond.push(q); });
  const src = pond.length ? pond : b;
  const q=src[rnd(0,src.length-1)];
  /* Une fiche sans `autres` est une question à saisie libre : les banques
     extraites du document éditorial en comportent beaucoup. `rendreExo` bascule
     tout seul sur le champ de saisie quand `choix` est absent. */
  const ex={q:q.q, r:q.r, exp:q.exp, cle:q.q};
  if(Array.isArray(q.autres) && q.autres.length>=2) ex.choix=melange([q.r,...q.autres]);
  ex.indice = q.indice || (p.cat==='histoire'
    ? 'Situe d’abord l’époque, le reste suit.'
    : 'Essaie de remplacer le mot par un équivalent pour trancher.');
  if(q.lien) ex.lien=q.lien;
  if(q.img)  ex.img=q.img;
  return ex;
}
function prochainExo(){
  const p=packActif, niv=packNiv(p.id);
  if(p.id==='conjugaison') return genConjugaison(niv);
  if(p.id==='maths')       return genMaths(niv);
  return choisirBanque(p);
}
let mission=null;
function lancerMission(){ mission={i:0, gagne:0, justes:0, aide:false, essais:0, vus:[]}; exoSuivant(); }
function exoSuivant(){
  if(mission.i>=NB_MISSION) return finMission();
  let q=null, garde=0;
  do{ q=prochainExo(); garde++; } while(garde<12 && mission.vus.includes(q.q));
  mission.vus.push(q.q);
  mission.q=q; mission.essais=0; mission.aide=false;
  rendreExo();
}
function rendreExo(){
  fondDefi();                       // une créature différente à chaque question
  const q=mission.q, p=packActif, saisie=!q.choix;
  $('#bourse-corps').innerHTML=`
    <div class="q-tete"><button class="retour" onclick="abandonner()">←</button>
      <div class="q-prog"><span>${p.ico} ${esc(p.nom)}</span>
        <span class="q-pts">${mission.i+1} / ${NB_MISSION}</span></div></div>
    <div class="q-barre"><i style="width:${mission.i/NB_MISSION*100}%"></i></div>
    <div class="q-carte">
      ${q.img?`<img class="q-img" src="${esc(q.img)}" alt="" loading="lazy"
                   onerror="this.remove()">`:''}
      <div class="q-txt">${esc(q.q)}</div>
      ${q.sujet?`<div class="q-sujet">${esc(q.sujet)}<span class="q-blanc">…</span></div>`:''}
      <div id="q-rep" class="${saisie?'q-saisie':'q-choix'}">
        ${saisie
          ? `<input id="q-input" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Ta réponse">
             <button class="btn-primaire" onclick="repondre($('#q-input').value)">Valider</button>`
          : q.choix.map(c=>`<button class="rep" onclick="repondre(this.textContent,this)">${esc(c)}</button>`).join('')}
      </div>
      <button class="btn-indice" id="btn-indice" onclick="montrerIndice()">Voir l'indice</button>
      <div class="q-fb" id="q-fb"></div>
    </div>`;
  const inp=$('#q-input');
  if(inp){ inp.focus(); inp.addEventListener('keydown',e=>{ if(e.key==='Enter') repondre(inp.value); }); }
}
function montrerIndice(){
  mission.aide=true;
  $('#btn-indice').style.display='none';
  const fb=$('#q-fb'); fb.className='q-fb indice';
  fb.innerHTML='💡 '+esc(mission.q.indice||'Relis l’énoncé en isolant la donnée qui commande la réponse.');
}
function normRep(s){
  return String(s||'').trim().toLowerCase()
    .replace(/[’‘`]/g,"'").replace(/\s+/g,' ').replace(/[.;!?]+$/,'')
    .replace(/^(je |j'|tu |il |elle |on |nous |vous |ils |elles |que |qu')+/g,'')
    .replace(/(\d),(\d)/g,'$1.$2');
}
function egal(a,b){
  if(normRep(a)===normRep(b))return true;
  const na=parseFloat(normRep(a).replace(/\s/g,'')), nb=parseFloat(normRep(b).replace(/\s/g,''));
  return isFinite(na)&&isFinite(nb)&&Math.abs(na-nb)<1e-6;
}
function repondre(val,btn){
  if(!mission||!mission.q)return;
  const q=mission.q, bon=egal(val,q.r), b=bareme(packActif);
  ancreGain=btn||null;
  const fb=$('#q-fb');
  if(bon){
    const autonome = mission.essais===0 && !mission.aide;
    const g = autonome ? b.juste : b.aide;
    mission.gagne+=g; mission.justes++;
    const st=statPack(packActif.id); st.tot++; if(autonome) st.ok++;
    if(q.cle && autonome){ const c=prog(packActif.id).c; c[q.cle]=(c[q.cle]||0)+1; }
    if(packActif.type==='gen' && autonome) prog(packActif.id).reussites++;
    if(btn) btn.classList.add('bon');
    $$('#q-rep .rep').forEach(x=>x.disabled=true);
    const inp=$('#q-input'); if(inp) inp.disabled=true;
    $('#btn-indice').style.display='none';
    fb.className='q-fb bon';
    fb.innerHTML=`<b>Juste.</b> ${esc(q.exp||'')}`
      +(q.lien?`<div class="q-src"><a href="${esc(q.lien[1]||'#')}" target="_blank" rel="noopener">${esc(q.lien[0])}</a></div>`:'')
      +`<button class="btn-primaire" onclick="suite()">Continuer</button>`;
    crediter(g); sauver(); return;
  }
  mission.essais++;
  if(btn) btn.classList.add('faux');
  if(mission.essais===1){
    fb.className='q-fb retry';
    fb.textContent='Pas encore. Il te reste un essai — l’indice est disponible.';
    const inp=$('#q-input'); if(inp) inp.select();
    return;
  }
  statPack(packActif.id).tot++;
  $$('#q-rep .rep').forEach(x=>{ x.disabled=true; if(egal(x.textContent,q.r)) x.classList.add('bon'); });
  const inp=$('#q-input'); if(inp) inp.disabled=true;
  $('#btn-indice').style.display='none';
  fb.className='q-fb faux';
  fb.innerHTML=`<b>Réponse : ${esc(q.r)}.</b> ${esc(q.exp||'')}<button class="btn-primaire" onclick="suite()">Continuer</button>`;
  sauver();
}
function suite(){ mission.i++; exoSuivant(); }
function abandonner(){
  if(mission&&mission.gagne) toast('Mission interrompue — '+mission.gagne+' \u25C8 conservés');
  mission=null; sauver(); ouvrirPack(packActif.id);
}
/* Ce que la joueuse lit en fin de mission décide si elle en relance une. On
   nomme donc ce qui a été fait, jamais ce qui a manqué : « 2 / 6 » se lit comme
   un bulletin, « deux d'emblée, le reste après un détour » se lit comme un
   parcours. Aucune de ces phrases n'est fausse. */
function phraseFin(justes){
  if(justes>=NB_MISSION) return 'Les six d’emblée. Rien à ajouter.';
  if(justes===0) return 'Six questions traversées, six explications lues. C’est comme ça qu’on apprend une matière neuve.';
  if(justes===1) return 'Une trouvée du premier coup, et cinq explications de plus en tête.';
  return justes+' trouvées du premier coup, le reste après un détour par l’explication.';
}
function finMission(){
  const b=bareme(packActif);
  const total=mission.gagne+crediter(b.mission);
  const a=avancePack(packActif);
  const manque=Math.max(0, COUT_FOUILLE-etat.credits);
  $('#bourse-corps').innerHTML=`
    <div class="fin">
      <div class="fin-ico">🎓</div>
      <h2>Mission terminée</h2>
      <p class="fin-score">${phraseFin(mission.justes)}</p>
      <div class="fin-credits">+${total} \u25C8</div>
      <p class="fin-note">${manque
        ? 'Encore '+manque+' \u25C8 avant le prochain coup de pioche.'
        : 'De quoi ouvrir une tranchée dès maintenant.'}</p>
      <p class="fin-prog">${esc(a.txt)}</p>
      <button class="btn-primaire" onclick="lancerMission()">Nouvelle mission</button>
      <button class="btn-fant" onclick="montrer('fouille')">Aller fouiller</button>
      <button class="btn-fant" onclick="menuPacks()">Choisir un autre pack</button>
    </div>`;
  mission=null; sauver();
}

/* ---------------- 7. Initialisation ---------------- */
function init(){
  $$('nav.tabs button').forEach(b=>b.addEventListener('click',()=>montrer(b.dataset.ecran)));
  $('#intro').addEventListener('click',introSuivant);
  $('#btn-fouiller').addEventListener('click',fouiller);
  $('#ch-retour').addEventListener('click',vueCarte);
  $('#ch-relire').addEventListener('click',()=>{ if(siteActif) introSite(siteActif,true); });
  $('#fiche-fermer').addEventListener('click',fermerFiche);
  $('#fiche').addEventListener('click',e=>{ if(e.target.id==='fiche') fermerFiche(); });
  $('#modal').addEventListener('click',e=>{ if(e.target.id==='modal') fermerModal(); });
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if($('#fiche').classList.contains('on'))return fermerFiche();
    if($('#modal').classList.contains('on'))return fermerModal();
    if($('#reveal').classList.contains('on'))return fermerReveal();
  });
  construireCarte(true);
  pzMonde=panzoom($('#svg-monde'),{
    minW:CARTE_ZOOM_MIN, maxW:1535, bounds:{x:0,y:0,w:1535,h:1024},
    tapSel:'.pin,.grappe',
    onVue:()=>construireCarte(),
    onTap:t=>{ if(t.sites) ouvrirGrappe(t.sites); else ouvrirSite(t.site); }
  });
  window.addEventListener('resize',()=>{ if(pzMonde) pzMonde.refit(); });
  majFondGlobal();
  majNomProfil();
  majSolde();
  montrer('fouille');
  $('#reglages').addEventListener('click',e=>{ if(e.target.id==='reglages') fermerReglages(); });
  /* La carte fine part une fois l'interface en place, pour ne pas concurrencer
     le premier affichage. */
  if('requestIdleCallback' in window) requestIdleCallback(chargerCarteFine,{timeout:4000});
  else setTimeout(chargerCarteFine,1500);
  if(!etat.accueilVu && trouvees().length>0){ etat.accueilVu=true; sauver(); }
  /* Une seule partie : on entre directement, l'écran de choix serait une
     formalité. Plusieurs : on demande, parce que se tromper de partie ne se
     voit qu'après coup. */
  if(registre.liste.length>1) ouvrirChoixProfil();
  else if(besoinAccueil()) ouvrirAccueil();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
document.addEventListener('DOMContentLoaded',init);
