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
const ATLAS_CLE='atlas_temps_profond_v1';
function etatVide(){
  return {credits:CREDITS_DEPART, collection:{}, packprog:{}, sitesOuverts:{},
          introVue:{}, sitesBonus:{}, qSite:{}, fouilles:0, echecs:0,
          stats:{}, ordre:{}, ordreN:0};
}
function lireLS(){try{const b=localStorage.getItem(ATLAS_CLE);return b?JSON.parse(b):null;}catch(e){return null;}}
function normaliser(e){const d=etatVide(); for(const k in d) if(e[k]===undefined) e[k]=d[k]; return e;}
let etat=normaliser(lireLS()||etatVide());
function sauver(){try{localStorage.setItem(ATLAS_CLE,JSON.stringify(etat));}catch(e){toast('Sauvegarde impossible');}}

const creaturesDe=site=>CREATURES.filter(c=>c.site===site);
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
const VOILE='linear-gradient(180deg,rgba(10,15,26,.80) 0%,rgba(10,15,26,.93) 45%,rgba(10,15,26,.985) 100%)';
function majFondGlobal(){
  const el=$('#fond-global'); if(!el)return;
  setFondImg(el, imageDeFond(), VOILE);
}
function montrer(ecran){
  $$('.ecran').forEach(e=>e.classList.toggle('actif', e.id==='ecran-'+ecran));
  $$('nav.tabs button').forEach(b=>b.classList.toggle('on', b.dataset.ecran===ecran));
  if(ecran==='fouille'){ vueCarte(); requestAnimationFrame(()=>{ if(pzMonde) pzMonde.refit(); }); }
  if(ecran==='collection'){ majFondGlobal(); rendreCollection(); }
  if(ecran==='bourse'){ majFondGlobal(); menuPacks(); }
}

/* ---------------- 4. Fouille ---------------- */
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
  const clampW=w=>Math.min(opt.maxW,Math.max(opt.minW,w));
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
  function refit(){fitH(); upd();}
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
  setFondImg($('#intro-fond'), s.fond,
    'linear-gradient(180deg,rgba(6,10,18,.30) 0%,rgba(6,10,18,.80) 48%,rgba(6,10,18,.98) 100%)');
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
  $('#ch-vignettes').innerHTML=creaturesDe(id).map(c=>{
    const ok=possede(c.id);
    return `<button class="vig${ok?'':' verrou'}" ${ok?`onclick="ouvrirFiche('${c.id}')"`:''}
      title="${ok?esc(c.nom):'Non découverte'}">
      ${ok?`<img src="${c.img}" loading="lazy" alt="${esc(c.nom)}">`:'<span class="vig-q">?</span>'}</button>`;
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
function trancheeSterile(){
  qFouille=null;
  $('#tranchee').classList.remove('on');
  $('#reveal-corps').innerHTML=`<div class="rev-vide">
    <div class="rev-vide-ico">⛏️</div>
    <div class="rev-vide-t">Tranchée stérile</div>
    <div class="rev-vide-s">Mal identifiée, mal dégagée : la pièce est restée dans la roche. La question reviendra.</div>
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
  if(complet){ etat.sitesBonus[siteActif]=true; etat.credits+=BONUS_SITE; }
  sauver(); majSolde(true);
  revealCarte(c, avant===0?'nouvelle':(apres>avant?'dossier':'fragment'), apres, complet);
}
function revealCarte(c,type,niv,bonusSite){
  const s=SITES.find(x=>x.id===c.site);
  const bandeau = type==='nouvelle' ? 'Créature inédite'
    : type==='dossier' ? 'Dossier enrichi — niveau '+niv : 'Fragment supplémentaire';
  const reste = niv<3 ? (SEUILS_DOC[niv]+1-fragments(c.id)) : 0;
  const sous = type==='nouvelle' ? c.groupe
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
    ${bonusSite?`<div class="rev-bonus">🏅 ${esc(s.court)} complété — +${BONUS_SITE} \u25C8</div>`:''}
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
function rendreCollection(){
  const tot=CREATURES.length, n=trouvees().length;
  $('#col-compte').textContent=n+' / '+tot;
  $('#col-corps').innerHTML=SITES.map(s=>{
    const cs=creaturesDe(s.id);
    return `<section class="col-bloc">
      <h3>${esc(s.court)} <small>${esc(s.ere)} · ${esc(s.age)}</small></h3>
      <div class="grille">${cs.map(c=>{
        const ok=possede(c.id), nv=niveauDoc(c.id);
        return `<button class="carte${ok?'':' verrou'}" ${ok?`onclick="ouvrirFiche('${c.id}')"`:''}>
          ${ok?`<img src="${c.img}" loading="lazy" alt="${esc(c.nom)}">
            <span class="c-niv" title="Niveau documentaire">${'●'.repeat(nv)}${'○'.repeat(3-nv)}</span>`
            :`<span class="c-q">?</span><span class="c-inconnu">Non découverte</span>`}
        </button>`;}).join('')}</div></section>`;
  }).join('');
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
    <h3 class="grp">Entraînement <em>${BAREME.base.juste} \u25C8 par bonne réponse</em></h3>
    ${PACKS.filter(p=>p.cat==='base').map(carteP).join('')}
    <h3 class="grp">Histoire <em>${BAREME.histoire.juste} \u25C8 par bonne réponse</em></h3>
    ${PACKS.filter(p=>p.cat==='histoire').map(carteP).join('')}
    <p class="bourse-note">L'entraînement rapporte davantage : il demande plus d'effort, il ne doit jamais être le choix perdant.</p>`;
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
  return {q:q.q, r:q.r, choix:melange([q.r,...q.autres]), exp:q.exp, cle:q.q,
          indice: p.cat==='histoire' ? 'Situe d’abord l’époque, le reste suit.'
                                     : 'Essaie de remplacer le mot par un équivalent pour trancher.'};
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
  const q=mission.q, p=packActif, saisie=!q.choix;
  $('#bourse-corps').innerHTML=`
    <div class="q-tete"><button class="retour" onclick="abandonner()">←</button>
      <div class="q-prog"><span>${p.ico} ${esc(p.nom)}</span>
        <span class="q-pts">${mission.i+1} / ${NB_MISSION}</span></div></div>
    <div class="q-barre"><i style="width:${mission.i/NB_MISSION*100}%"></i></div>
    <div class="q-carte">
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
    fb.innerHTML=`<b>Juste.</b> ${esc(q.exp||'')}<button class="btn-primaire" onclick="suite()">Continuer</button>`;
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
function finMission(){
  const b=bareme(packActif);
  const total=mission.gagne+crediter(b.mission);
  const a=avancePack(packActif);
  const manque=Math.max(0, COUT_FOUILLE-etat.credits);
  $('#bourse-corps').innerHTML=`
    <div class="fin">
      <div class="fin-ico">🎓</div>
      <h2>Mission terminée</h2>
      <p class="fin-score">${mission.justes} / ${NB_MISSION} du premier coup</p>
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
  majSolde();
  montrer('fouille');
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
document.addEventListener('DOMContentLoaded',init);
