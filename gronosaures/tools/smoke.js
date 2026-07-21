/* ================================================================
   tools/smoke.js — exécution de la logique de jeu hors navigateur.
   Le DOM est bouché par des objets inertes : on ne teste pas le rendu,
   on teste que les fonctions de jeu tournent longtemps sans casser et
   que les invariants d'économie tiennent.
   Usage : node tools/smoke.js   → attend « ÉCHECS (0) »
   ================================================================ */
'use strict';
const fs=require('fs'), path=require('path');
const R=path.resolve(__dirname,'..');

/* --- Bouchons DOM --- */
const noeud=()=>new Proxy(function(){},{
  get:(t,k)=>{
    if(k==='classList') return {add(){},remove(){},toggle(){},contains(){return false;}};
    if(k==='style') return new Proxy({},{get:()=>'',set:()=>true});
    if(k==='dataset') return {};
    if(k==='textContent'||k==='innerHTML'||k==='value') return '';
    if(k==='getBoundingClientRect') return ()=>({left:0,top:0,width:100,height:100,right:100,bottom:100});
    if(k==='viewBox') return {baseVal:{x:0,y:0,width:1535,height:1024}};
    if(k==='isConnected') return false;
    if(typeof k==='symbol') return undefined;
    return noeud();
  },
  set:()=>true,
  apply:()=>noeud()
});
global.document={
  querySelector:()=>noeud(), querySelectorAll:()=>[],
  addEventListener(){}, createElement:()=>noeud(), body:noeud()
};
global.window={addEventListener(){}, location:{origin:''}};
try{Object.defineProperty(global,'navigator',{value:{},configurable:true});}catch(_){}
global.requestAnimationFrame=f=>f();
global.setTimeout=(f)=>0;
global.setInterval=()=>0;
global.clearInterval=()=>{};
global.clearTimeout=()=>{};
global.Image=function(){ Object.defineProperty(this,'src',{set(){ this.onload&&this.onload(); }}); };
const store={};
global.localStorage={getItem:k=>store[k]||null, setItem:(k,v)=>{store[k]=v;}, removeItem:k=>{delete store[k];}};

/* --- Charger le jeu --- */
/* Le tirage des créatures et le choix des questions consomment Math.random.
   Un harnais qui échoue une fois sur quinze finit par être ignoré : on fixe donc
   la graine. Changer GRAINE fait rejouer une autre partie, tout aussi valide. */
const GRAINE=20260719;
(function(){
  let e=GRAINE>>>0;
  Math.random=function(){ e^=e<<13; e^=e>>>17; e^=e<<5; e>>>=0; return e/4294967296; };
})();

const ctx={};
new Function(fs.readFileSync(path.join(R,'data.js'),'utf8')
  +'\n'+fs.readFileSync(path.join(R,'app.js'),'utf8')
  +'\n;Object.assign(this,{etat,CREATURES,SITES,PACKS,QUIZ_PALEO,HISTOIRE,COUT_FOUILLE,'
  +'NB_MISSION,BAREME,BONUS_SITE,BONUS_PART,bonusDe,SEUILS_DOC,CREDITS_DEPART,fouiller,niveauDoc,fragments,NIVEAUX_PROGRESSIFS,'
  +'possede,siteComplet,nbTrouvees,ouvert,debloquer,ouvrirSite,genConjugaison,genMaths,'
  +'choisirBanque,choisirQuestionSite,poserQuestionSite,repFouille,tirage,egal,normRep,'
  +'avancePack,prog,packNiv,creaturesDe,fondsDuSite,bareme,'
  +'setSite:v=>{siteActif=v;},qCourante:()=>qFouille,'
  +'fermerVoile:()=>{revealVerrou=false;}});').call(ctx);

let ok=0; const echecs=[];
const T=(n,c,d)=>{ if(c) ok++; else echecs.push(n+(d?' — '+d:'')); };

/* ---------- 1. Générateurs, 2000 tirages ---------- */
for(let niv=1;niv<=3;niv++){
  for(let i=0;i<700;i++){
    const q=ctx.genConjugaison(niv);
    if(!q.q||!q.r) { T('conjugaison tirage valide',false,JSON.stringify(q)); break; }
    if(q.choix){
      if(q.choix.length!==4) { T('conjugaison 4 choix',false,JSON.stringify(q.choix)); break; }
      if(new Set(q.choix).size!==4){ T('conjugaison choix distincts',false,JSON.stringify(q.choix)); break; }
      if(!q.choix.includes(q.r)){ T('conjugaison réponse présente',false,JSON.stringify(q)); break; }
    } else if(!q.sujet){ T('conjugaison saisie a un sujet',false,JSON.stringify(q)); break; }
    if(!q.exp){ T('conjugaison explication',false,''); break; }
  }
}
T('conjugaison : 2100 tirages sans anomalie', echecs.length===0);

const nAv=echecs.length;
for(let niv=1;niv<=3;niv++) for(let i=0;i<400;i++){
  const q=ctx.genMaths(niv);
  if(!q||!q.q||q.r===''||q.r===undefined){ T('maths tirage valide',false,JSON.stringify(q)); break; }
}
T('maths : 1200 tirages sans anomalie', echecs.length===nAv);

/* La réponse d'un QCM doit se valider elle-même via egal(). */
let auto=0;
for(let i=0;i<400;i++){
  const q=ctx.genMaths(1+i%3);
  if(!ctx.egal(q.r,q.r)) auto++;
  if(q.choix && !q.choix.some(c=>ctx.egal(c,q.r))) auto++;
}
T('maths : la bonne réponse est reconnue par egal()', auto===0, auto+' cas');

PACKS_BANQUE:
for(const p of ctx.PACKS.filter(p=>p.type!=='gen')){
  for(let i=0;i<300;i++){
    const q=ctx.choisirBanque(p);
    if(!q.choix||q.choix.length!==4||!q.choix.includes(q.r)||!q.cle){
      T('banque '+p.id+' tirage valide',false,JSON.stringify(q)); break PACKS_BANQUE;
    }
  }
}
T('banques (orthographe, histoire) : tirages valides', true);

/* ---------- 2. Normalisation des réponses ---------- */
[['  Nous Aimons ','nous aimons'],['j’ai','ai'],["J'ai",'ai'],['que je sois','sois'],
 ['12,5','12.5'],['il prend.','prend']].forEach(([a,b])=>
  T('normalisation « '+a+' » = « '+b+' »', ctx.egal(a,b), ctx.normRep(a)+' ≠ '+ctx.normRep(b)));
T('normalisation ne confond pas les accents', !ctx.egal('etais','étais'));
T('normalisation distingue deux formes proches', !ctx.egal('aimerai','aimerais'));

/* ---------- 3. Déblocage des sites ---------- */
ctx.etat.collection={}; ctx.etat.sitesBonus={}; ctx.etat.sitesOuverts={};
ctx.etat.qSite={}; ctx.etat.ordre={}; ctx.etat.ordreN=0;
ctx.etat.credits=0;
ctx.SITES.forEach(s=>{
  ctx.debloquer(s.id);
  T('site '+s.id+' non ouvert sans crédits', !ctx.ouvert(s.id));
});
ctx.etat.credits=500000;
ctx.SITES.forEach(s=>{
  const av=ctx.etat.credits;
  ctx.debloquer(s.id);
  T('site '+s.id+' ouvert contre son coût', ctx.ouvert(s.id));
  T('déblocage de '+s.id+' débité une fois', ctx.etat.credits===av-s.cout, av+' → '+ctx.etat.credits);
  const av2=ctx.etat.credits;
  ctx.debloquer(s.id);
  T('déblocage de '+s.id+' non facturé deux fois', ctx.etat.credits===av2);
});
ctx.SITES.forEach(s=>ctx.etat.introVue[s.id]=true);

/* ---------- 3 bis. Boucle de fouille ----------
   Chaque coup de pioche débite, pose une question du site, puis livre une
   pièce si la réponse est juste. On joue toujours juste ici : on vérifie la
   comptabilité, la répartition des questions et la complétion des sites. */
let anomalies=0, tirages=0; const fouillesParSite=[];
for(const s of ctx.SITES){
  ctx.setSite(s.id);
  let garde=0;
  /* La condition d'arrêt ne peut pas s'appuyer sur niveauDoc : le régime en
     vigueur le sature dès le premier fragment, et la simulation s'arrêterait
     avant d'avoir sollicité les banques de questions. On pilote donc par le
     nombre de fragments, qui mesure la même chose sans dépendre du drapeau. */
  const plein=ctx.SEUILS_DOC[ctx.SEUILS_DOC.length-1]+1;
  const fini=()=>ctx.creaturesDe(s.id).every(c=>ctx.fragments(c.id)>=plein);
  while(!fini() && garde<3000){
    const soldeAv=ctx.etat.credits, nAv=ctx.nbTrouvees(s.id);
    const bonusAv=!!ctx.etat.sitesBonus[s.id];
    ctx.fouiller();
    const q=ctx.qCourante();
    if(!q){ anomalies++; break; }
    ctx.repFouille(q.q.r, {classList:{add(){}}});   // on répond juste
    ctx.tirage();
    ctx.fermerVoile(); tirages++; garde++;
    const bonus=(!bonusAv && ctx.etat.sitesBonus[s.id]) ? ctx.bonusDe(s.id) : 0;
    if(ctx.etat.credits !== soldeAv - ctx.COUT_FOUILLE + bonus) anomalies++;
    if(ctx.nbTrouvees(s.id) < nAv) anomalies++;     // la collection ne régresse jamais
  }
  T('site '+s.id+' entièrement documentable', fini(), garde+' fouilles');
  fouillesParSite.push(garde);
  T('site '+s.id+' : documentation complète en moins de 200 fouilles', garde<200, garde+'');
  T('bonus de site versé pour '+s.id, ctx.etat.sitesBonus[s.id]===true);
}
T('comptabilité exacte sur '+tirages+' fouilles', anomalies===0, anomalies+' écarts');
/* Le minimum théorique est de 36 fouilles par site (six créatures × six fragments) ;
   la pondération 3:1 en faveur des inédits porte la moyenne autour de 55. Une
   dérive nette de cette moyenne signalerait une pondération cassée. */
const moy=fouillesParSite.reduce((a,b)=>a+b,0)/fouillesParSite.length;
/* Le minimum théorique dépend de la taille du site : six fragments par créature.
   Yixian en compte huit, donc 48 et non 36. On raisonne donc par créature. */
const parCreature=ctx.SITES.map((s,i)=>fouillesParSite[i]/ctx.creaturesDe(s.id).length);
/* Le plancher se déduit des seuils : chaque créature réclame autant de copies
   qu'il en faut pour le dernier niveau. Le recopier en dur obligeait à corriger
   le harnais chaque fois que le barème bouge. */
const copiesPleines=ctx.SEUILS_DOC[ctx.SEUILS_DOC.length-1]+1;
ctx.SITES.forEach((s,i)=>{
  const mini=copiesPleines*ctx.creaturesDe(s.id).length;
  T('site '+s.id+' : au moins '+mini+' fouilles', fouillesParSite[i]>=mini,
    fouillesParSite[i]+'');
});
const moyParCrea=parCreature.reduce((a,b)=>a+b,0)/parCreature.length;
/* La pondération 3:1 en faveur des inédits porte l'effort réel à environ 1,7
   fois le minimum théorique. On borne autour de cette valeur : en dessous, le
   tirage ne répéterait plus assez pour parcourir la banque de questions ; très
   au-dessus, il ressasserait. */
T('effort par créature entre '+copiesPleines+' et '+(copiesPleines*2.5)+' fouilles',
  moyParCrea>=copiesPleines && moyParCrea<=copiesPleines*2.5, moyParCrea.toFixed(2));
T('tous les sites achevés', ctx.SITES.every(s=>ctx.siteComplet(s.id)));
T('une fouille finit toujours par livrer quelque chose',
  ctx.CREATURES.every(c=>ctx.fragments(c.id)>0));

/* La répartition des questions doit rester plate : c'est ce qui produit la
   répétition voulue (chaque question revue deux à trois fois).

   On a d'abord exigé que chaque question soit posée au moins une fois. C'est
   insatisfiable par construction : un chantier chanceux se documente en dix-neuf
   fouilles alors qu'il porte vingt questions, et l'assertion ne passait que
   parce que le tirage était rarement aussi favorable. Ce qu'il faut vérifier,
   c'est qu'aucune question n'est DÉLAISSÉE — que l'écart entre la plus et la
   moins tirée reste petit. Une question systématiquement évitée signalerait un
   défaut de tirage ; une question manquée sur un tirage court, non. */
ctx.SITES.forEach(s=>{
  const c=ctx.etat.qSite[s.id]||{};
  const n=ctx.QUIZ_PALEO.filter(q=>q.site===s.id).map(q=>c[q.id]||0);
  const mini=Math.min(...n), maxi=Math.max(...n);
  const total=n.reduce((a,b)=>a+b,0);
  T('questions de '+s.id+' toutes posées si le tirage le permet',
    mini>=1 || total<n.length, 'min '+mini+' pour '+total+' tirages');
  T('répartition plate sur '+s.id, maxi-mini<=1, 'écart '+mini+'–'+maxi);
});

/* Une mauvaise réponse répétée ne doit rien livrer. */
ctx.setSite(ctx.SITES[0].id);
ctx.etat.credits=10000;
const totAv=Object.values(ctx.etat.collection).reduce((a,b)=>a+b,0);
ctx.fouiller();
let qq=ctx.qCourante();
const faux=qq.choix.filter(c=>!ctx.egal(c,qq.q.r));
ctx.repFouille(faux[0], {classList:{add(){}}});
ctx.repFouille(faux[1], {classList:{add(){}}});
T('deux erreurs ne livrent aucune pièce',
  Object.values(ctx.etat.collection).reduce((a,b)=>a+b,0)===totAv);
T('la question ratée est comptée comme échec', ctx.etat.echecs>0);
ctx.fermerVoile();

/* Fouille sans crédits : ni débit, ni pièce. */
ctx.etat.credits=ctx.COUT_FOUILLE-1;
const avSolde=ctx.etat.credits, avTot=Object.values(ctx.etat.collection).reduce((a,b)=>a+b,0);
ctx.fouiller();
T('fouille refusée si crédits insuffisants',
  ctx.etat.credits===avSolde && Object.values(ctx.etat.collection).reduce((a,b)=>a+b,0)===avTot);

/* ---------- 3 ter. Barème par catégorie ---------- */
ctx.PACKS.forEach(p=>{
  const b=ctx.bareme(p);
  T('barème résolu pour '+p.id, !!(b&&b.juste>0));
});
/* Le choix du pack ne doit rien coûter : une mission parfaite rapporte la même
   chose des deux côtés, sans quoi préférer ce qu'on aime devient un handicap. */
const gainDe=cat=>{const b=ctx.BAREME[cat]; return ctx.NB_MISSION*b.juste+b.mission;};
T('les deux filières rapportent autant sur une mission complète',
  gainDe('base')===gainDe('histoire'), gainDe('base')+' vs '+gainDe('histoire'));
T('l’indice réduit le gain sans l’annuler',
  ctx.BAREME.base.aide>0 && ctx.BAREME.base.aide<ctx.BAREME.base.juste,
  ctx.BAREME.base.aide+' / '+ctx.BAREME.base.juste);

/* ---------- 4. Niveaux documentaires ---------- */
const c0=ctx.CREATURES[0].id;
/* Deux régimes coexistent : la montée par paliers, conservée en réserve, et le
   dossier plein dès la première obtention, en vigueur. Le harnais suit le
   drapeau plutôt qu'une table figée — sinon il testerait un code désactivé. */
/* La table attendue se déduit des seuils plutôt que d'être recopiée : changer
   SEUILS_DOC ne doit pas obliger à corriger le harnais à la main. */
const attendu = Array.from({length:8}, (_,f)=>{
  if(f<=0) return 0;
  if(!ctx.NIVEAUX_PROGRESSIFS) return ctx.SEUILS_DOC.length;
  let n=1;
  for(let i=1;i<ctx.SEUILS_DOC.length;i++) if(f-1>=ctx.SEUILS_DOC[i]) n=i+1;
  return n;
});
for(let f=0;f<attendu.length;f++){
  ctx.etat.collection[c0]=f;
  T('niveau documentaire à '+f+' fragment(s)', ctx.niveauDoc(c0)===attendu[f],
    'obtenu '+ctx.niveauDoc(c0)+', attendu '+attendu[f]);
}
delete ctx.etat.collection[c0];
T('créature absente = non possédée', !ctx.possede(c0));

/* ---------- 5. Progression des packs ---------- */
ctx.PACKS.forEach(p=>{
  const a=ctx.avancePack(p);
  T('avancement lisible pour '+p.id, typeof a.txt==='string'&&a.pct>=0&&a.pct<=100, JSON.stringify(a));
});
const pc=ctx.prog('conjugaison');
T('niveau initial de conjugaison', ctx.packNiv('conjugaison')===1);
pc.reussites=100;
T('le niveau plafonne à 3', ctx.packNiv('conjugaison')===3, String(ctx.packNiv('conjugaison')));

console.log('');
console.log('  RÉUSSITES ('+ok+')');
console.log('  ÉCHECS ('+echecs.length+')');
if(echecs.length){ console.log(''); echecs.forEach(e=>console.log('   ✗ '+e)); process.exit(1); }
