/* ================================================================
   tools/etats_test.js — porte de MACHINE À ÉTATS.

   Les autres portes vérifient les données (qc.js), le rendu d'un écran
   (ui_niveaux.js), l'économie moyenne (smoke.js) et le martelage d'un
   bouton (exploit_check.js). Aucune ne JOUE une partie jusqu'au bout.

   C'est exactement le trou par lequel est passé le bug le plus grave de
   v105 : un niveau ne pouvait PAS être acquis. `repondre()` n'écrivait la
   maîtrise que pour les questions portant une `cle`, les fiches de niveau
   n'en portaient pas, et `niveauAcquis()` lisait une clé (`q.n`) que
   personne n'écrivait. Treize mille assertions et un parcours d'écran
   complet ne l'ont pas vu, parce qu'aucun des deux ne répondait six fois
   juste deux fois de suite.

   Règle : tout ce qui se mesure sur PLUSIEURS transitions se teste ici.
   Usage : node tools/etats_test.js — exiger « ÉCHECS (0) ».
   ================================================================ */
'use strict';
const fs=require('fs'), path=require('path');
const R=path.resolve(__dirname,'..');

/* ---- Faux DOM (même stratégie que ui_niveaux.js) ---- */
const el=()=>({classList:{add(){},remove(){},toggle(){},contains(){return false}},
  removeAttribute(){}, setAttribute(){}, disabled:false, set src(v){},
  style:{}, dataset:{}, set textContent(v){this._t=v}, get textContent(){return this._t||''},
  set innerHTML(v){this._h=v}, get innerHTML(){return this._h||''},
  addEventListener(){}, appendChild(){}, querySelector(){return el()},
  querySelectorAll(){return []}, focus(){}, select(){}, scrollTo(){},
  getBoundingClientRect(){return {width:360,height:640}}});
/* Contrairement à ui_niveaux.js, les éléments sont MÉMORISÉS par identifiant :
   sans cela `$('#bourse-corps').innerHTML` retourne un objet neuf à chaque
   appel et l'on ne peut rien lire de ce qui a été rendu. Or les bugs visés ici
   sont précisément des bugs d'écran reconstruit. */
const registreEl=new Map();
const parId=id=>{ if(!registreEl.has(id)) registreEl.set(id, el()); return registreEl.get(id); };
const store={};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),
  localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>store[k]=String(v),
                removeItem:k=>delete store[k]},
  location:{href:''},scrollTo(){}};
global.localStorage=window.localStorage;
global.document={getElementById:id=>parId(id),
  querySelector:s=>(/^#[\w-]+$/.test(s) ? parId(s.slice(1)) : el()),
  querySelectorAll:()=>[],
  createElement:()=>el(),body:el(),documentElement:el(),addEventListener(){},
  readyState:'complete'};
Object.defineProperty(global,'navigator',{configurable:true,writable:true,
  value:{serviceWorker:{register(){return Promise.resolve()}},onLine:true}});
global.fetch=()=>Promise.resolve({json:()=>Promise.resolve({})});
global.setTimeout=(f)=>{try{f()}catch(e){}; return 0};
global.clearInterval=()=>{}; global.setInterval=()=>0;
global.requestAnimationFrame=f=>{try{f(0)}catch(e){}; return 0};
Object.defineProperty(global,'crypto',{configurable:true,writable:true,
  value:{randomUUID:()=>'u'+Math.random().toString(36).slice(2)}});
global.Image=function(){ return {set src(v){}, addEventListener(){}, onload:null, onerror:null}; };
global.Audio=function(){ return {play(){}, pause(){}, addEventListener(){}}; };

const src=fs.readFileSync(R+'/data.js','utf8')+'\n'+fs.readFileSync(R+'/app.js','utf8');
const EXPORTS='PACKS,SITES,CREATURES,QUIZ_PALEO,etat,registre,PRIME_NIVEAU,SEUIL_MAITRISE,'
 +'NB_MISSION,NB_ESSAIS,COUT_FOUILLE,cleNiveau,niveauAcquis,prog,lancerNiveau,lancerMission,'
 +'repondre,suite,exoSuivant,ouvrirPack,menuPacks,montrer,enregistrerNiveaux,statPack,'
 +'montrerIndice,reprendreExo,sauver,fouiller,repFouille,indiceFouille,tirage,trancheeSterile,'
 +'reprendreFouille,possede,fragments,chantier,basculerProfil,creerProfil,primeDe,trouvees,'
 +'carnet,carnetSupprimer,normaliser,eidNeuf,'
 +'mission:()=>mission,setMission:v=>mission=v,packActif:()=>packActif,'
 +'niveauActif:()=>niveauActif,qFouille:()=>qFouille,setSite:v=>siteActif=v,'
 +'getEtat:()=>etat';

/* Recharger l'application, en gardant le MÊME localStorage : c'est la seule
   façon d'éprouver ce qui survit à une fermeture d'onglet ou à une mise en
   veille du téléphone — c'est-à-dire, pour la fouille, tout ce qui compte. */
function charger(){
  const c={};
  try{ new Function(src+'\n;Object.assign(this,{'+EXPORTS+'});').call(c); }
  catch(e){ console.log('  chargement : ÉCHEC —', e.message); process.exit(1); }
  c.enregistrerNiveaux();
  return c;
}
let ctx=charger();

let ok=0; const echecs=[];
function T(n,cond,d){ if(cond) ok++; else echecs.push(n+(d?' — '+d:'')); }

/* =================================================================
   1. PROGRESSION D'UNE SÉRIE — jouer un niveau jusqu'à l'acquisition
   ================================================================= */
function jouerNiveau(packId, i, {juste=true, parfait=true}={}){
  ctx.lancerNiveau(packId,i);
  const p=ctx.PACKS.find(x=>x.id===packId);
  const total=Math.min(ctx.NB_MISSION, p.niveaux[i].bank().length);
  const vus=[];
  for(let k=0;k<ctx.NB_MISSION;k++){
    const m=ctx.mission(); if(!m||!m.q) break;
    vus.push(m.q.cle);
    ctx.repondre(juste ? m.q.r : '\u2014 réponse volontairement fausse \u2014');
    if(!parfait && !juste) ctx.repondre('\u2014 encore fausse \u2014');
    ctx.suite();
  }
  return vus;
}

const P=ctx.PACKS.find(p=>p.niveaux && p.niveaux[0].bank().length===ctx.NB_MISSION);
T('une série à six questions par niveau existe', !!P);

if(P){
  const creditsAvant=ctx.etat.credits;
  let s0=ctx.etat.credits;

  const vus1=jouerNiveau(P.id,0);
  const gain1=ctx.etat.credits-s0; s0=ctx.etat.credits;
  /* On n'impose pas un format de clé, seulement ce qui compte : chaque
     question en porte une, et elle est propre à son niveau. */
  T('les six questions du niveau portent une clé de maîtrise',
    vus1.length===6 && vus1.every(c=>typeof c==='string' && c.length>0)
    && new Set(vus1).size===6, JSON.stringify(vus1));
  T('un seul passage parfait ne suffit pas (SEUIL_MAITRISE=2)',
    !ctx.niveauAcquis(P.id,0));

  jouerNiveau(P.id,0);
  const gain2=ctx.etat.credits-s0; s0=ctx.etat.credits;
  T('deux passages parfaits acquièrent le niveau', ctx.niveauAcquis(P.id,0),
    'progression : '+JSON.stringify(ctx.prog(P.id).c));
  T('le niveau est marqué fini', !!(ctx.etat.niveauxFinis||{})[P.id+':0']);

  /* La prime doit tomber une fois — pas zéro (bug v105), pas deux.
     On la mesure par différence : trois passages parfaits identiques, seul
     celui qui acquiert le niveau doit valoir PRIME_NIVEAU de plus. */
  jouerNiveau(P.id,0);
  const gain3=ctx.etat.credits-s0;
  T('la prime tombe exactement au passage qui acquiert le niveau',
    gain2===gain1+ctx.PRIME_NIVEAU, gain1+' / '+gain2+' / '+gain3+' ◈');
  T('la prime de niveau ne tombe qu une fois', gain3===gain1,
    'passage 1 : '+gain1+' ◈, passage 3 : '+gain3+' ◈');
  T('le solde a bien augmenté depuis le début', ctx.etat.credits>creditsAvant);

  /* ---- Étanchéité entre niveaux : le piège du correctif naïf ----
     Les questions sont numérotées 1..6 dans CHAQUE niveau. Une clé bâtie
     sur le seul numéro aurait déclaré acquis le niveau 2 en même temps
     que le niveau 1. */
  if(P.niveaux.length>1){
    T('acquérir le niveau 1 ne donne pas le niveau 2', !ctx.niveauAcquis(P.id,1));
    const c=ctx.prog(P.id).c;
    const cles0=P.niveaux[0].bank().map(q=>ctx.cleNiveau(0,q.n));
    const cles1=P.niveaux[1].bank().map(q=>ctx.cleNiveau(1,q.n));
    T('aucune clé partagée entre deux niveaux',
      cles0.every(k=>!cles1.includes(k)));
    T('le niveau 2 n a aucune maîtrise écrite', cles1.every(k=>!c[k]));
  }
}

/* Toutes les séries : chaque niveau doit être acquérable, c'est-à-dire que
   chacune de ses questions doit produire une clé distincte et stable. */
let clesTotal=0; const vues=new Set(); let doublons=0;
ctx.PACKS.filter(p=>p.niveaux).forEach(p=>p.niveaux.forEach((n,i)=>{
  n.bank().forEach(q=>{
    const k=p.id+'/'+ctx.cleNiveau(i,q.n); clesTotal++;
    if(vues.has(k)) doublons++; vues.add(k);
  });
}));
T('toutes les questions de niveau ont une clé unique', doublons===0,
  doublons+' doublons sur '+clesTotal);

/* =================================================================
   2. FORME DES QUESTIONS — un QCM doit rester un QCM
   ================================================================= */
if(P){
  ctx.lancerNiveau(P.id,0);
  let saisiesLibres=0, avecChoix=0;
  for(let k=0;k<ctx.NB_MISSION;k++){
    const m=ctx.mission(); if(!m||!m.q) break;
    if(m.q.choix && m.q.choix.length>=3) avecChoix++; else saisiesLibres++;
    T('la bonne réponse figure parmi les propositions',
      !m.q.choix || m.q.choix.includes(m.q.r));
    ctx.repondre(m.q.r); ctx.suite();
  }
  T('les questions de niveau sont présentées en QCM', saisiesLibres===0,
    saisiesLibres+' saisies libres sur '+(saisiesLibres+avecChoix));
}
/* Sur l'ensemble du corpus : aucune fiche de niveau ne doit tomber en saisie
   libre faute de leurres. */
let sansLeurres=0;
ctx.PACKS.filter(p=>p.niveaux).forEach(p=>p.niveaux.forEach(n=>n.bank().forEach(q=>{
  if(!Array.isArray(q.autres)||q.autres.length<2) sansLeurres++;
})));
T('toute fiche de niveau porte au moins deux leurres', sansLeurres===0,
  sansLeurres+' fiches sans leurres');

/* =================================================================
   3. INTERRUPTION DE MISSION — quitter la Bourse et y revenir
   Le rapport de revue : `montrer('bourse')` appelait `exoSuivant()`.
   Avant réponse   → question remplacée, essais remis à zéro (reroll gratuit).
   Après réponse   → nouvelle question servie sur une mission déjà résolue :
                     propositions inertes, plus de bouton Continuer, soft-lock.
   ================================================================= */
const corps=()=>parId('bourse-corps').innerHTML||'';
const fbk=()=>(parId('q-fb').innerHTML||'')+' '+(parId('q-fb').className||'');
function detour(){ ctx.montrer('carnet'); ctx.montrer('bourse'); }

if(P){
  /* --- avant toute réponse --- */
  ctx.lancerNiveau(P.id,0);
  let m=ctx.mission();
  const q0=m.q, sold0=ctx.etat.credits;
  detour();
  m=ctx.mission();
  T('un aller-retour ne change pas la question posée', m.q===q0,
    m.q ? 'question différente' : 'plus de question du tout');
  T('un aller-retour ne rapporte rien', ctx.etat.credits===sold0);
  T('la carte de question est bien redessinée', /q-carte/.test(corps()));

  /* --- après un essai raté : les essais ne doivent pas se réinitialiser --- */
  ctx.repondre('\u2014 faux \u2014');
  T('un essai raté est compté', ctx.mission().essais===1);
  detour();
  T('un aller-retour ne rend pas l essai perdu', ctx.mission().essais===1,
    'essais = '+ctx.mission().essais);
  T('un aller-retour ne change pas la question après un raté', ctx.mission().q===q0);

  /* --- après résolution, avant Continuer : le cas du soft-lock --- */
  ctx.repondre(q0.r);
  const soldeResolu=ctx.etat.credits;
  T('la question est résolue', ctx.mission().resolue===true);
  T('l écran de correction propose Continuer', /suite\(\)/.test(fbk()));
  detour();
  T('la mission reste résolue après un aller-retour', ctx.mission().resolue===true);
  T('aucune question neuve n est servie sur une mission résolue',
    ctx.mission().q===q0);
  T('Continuer est toujours là après un aller-retour', /suite\(\)/.test(fbk()));
  T('la correction est toujours affichée', /Juste\./.test(fbk()));
  T('revenir dans la Bourse ne repaie pas la question',
    ctx.etat.credits===soldeResolu, ctx.etat.credits+' vs '+soldeResolu);

  /* --- Continuer fonctionne toujours après la reprise --- */
  ctx.suite();
  T('Continuer sert bien la question suivante après reprise',
    ctx.mission() && ctx.mission().q && ctx.mission().q!==q0);
  T('la question suivante repart d un état vierge',
    ctx.mission().essais===0 && ctx.mission().resolue===false
    && !Object.keys(ctx.mission().marques||{}).length);

  /* --- l'indice survit lui aussi au détour --- */
  const mq=ctx.mission().q;
  ctx.montrerIndice && ctx.montrerIndice();
  if(ctx.montrerIndice){
    T('l indice marque la mission comme aidée', ctx.mission().aide===true);
    detour();
    T('l indice reste affiché après un aller-retour', /indice/.test(fbk()));
    T('l aide n est pas effacée par le détour', ctx.mission().aide===true);
    T('la question reste la même après avoir demandé l indice', ctx.mission().q===mq);
  }
}

/* Aucun chemin de navigation ne doit appeler exoSuivant() implicitement. */
const appSrc=fs.readFileSync(R+'/app.js','utf8');
const bloc=(appSrc.match(/if\(ecran==='bourse'\)\{[\s\S]*?\n  \}/)||[''])[0];
T('montrer(bourse) ne tire pas de question', !/exoSuivant\(\)/.test(bloc), bloc.trim());
T('montrer(bourse) passe par reprendreExo', /reprendreExo\(\)/.test(bloc));

/* =================================================================
   4. TRANSACTION DE FOUILLE
   Le crédit part à l'ouverture de la tranchée, le résultat arrive après la
   question. Tout ce qui se passe entre les deux — fermeture d'onglet,
   rechargement, mise en veille — doit laisser la sauvegarde dans un état
   honorable : soit une fouille due, soit rien. Jamais un débit sec.
   ================================================================= */
function siteJouable(c){
  return c.SITES.map(s=>s.id).find(id=>c.QUIZ_PALEO.some(q=>q.site===id));
}
const site=siteJouable(ctx);
T('un chantier avec des questions existe', !!site);

if(site){
  /* --- le débit et la dette sont écrits ensemble --- */
  ctx.etat.credits=5000; ctx.etat.fouilleEnCours=null; ctx.sauver();
  ctx.setSite(site);
  const avantFouille=ctx.etat.credits;
  ctx.fouiller();
  /* Tolérant à l'absence : une porte doit RAPPORTER l'échec, pas planter —
     un harnais qui s'interrompt ne dit rien sur les assertions suivantes. */
  const f=ctx.etat.fouilleEnCours||{};
  T('la fouille débite le coût', ctx.etat.credits===avantFouille-ctx.COUT_FOUILLE);
  T('la fouille inscrit une dette', f.site===site && f.statut==='question');
  T('la dette porte la question posée', !!f.qid);
  T('la dette porte l ordre des propositions',
    Array.isArray(f.choix) && f.choix.length>0);

  /* --- rechargement APRÈS le paiement, avant la réponse --- */
  const qid=f.qid, soldePaye=ctx.etat.credits;
  ctx=charger();
  T('la dette survit au rechargement',
    !!qid && !!ctx.etat.fouilleEnCours && ctx.etat.fouilleEnCours.qid===qid);
  T('le rechargement ne redébite pas', ctx.etat.credits===soldePaye);
  ctx.reprendreFouille();
  const qf=ctx.qFouille()||{};
  T('la tranchée rouvre sur la même question', !!qf.q && qf.q.id===qid);
  T('la tranchée rouvre avec le même ordre de propositions',
    JSON.stringify(qf.choix||null)===JSON.stringify(f.choix||undefined));
  T('la reprise ne coûte rien', ctx.etat.credits===soldePaye);

  /* --- rechargement APRÈS la bonne réponse, avant « Extraire la pièce » --- */
  const bonneRep=qf.q ? qf.q.r : null;
  if(bonneRep) ctx.repFouille(bonneRep, {classList:{add(){}}, disabled:false});
  T('la bonne réponse fait passer la dette en récompense',
    ctx.etat.fouilleEnCours && ctx.etat.fouilleEnCours.statut==='recompense');
  const soldeAvantExtraction=ctx.etat.credits;
  ctx=charger();
  T('une récompense due survit au rechargement',
    !!ctx.etat.fouilleEnCours && ctx.etat.fouilleEnCours.statut==='recompense');
  ctx.reprendreFouille();
  T('la tranchée rouvre déjà résolue', !!ctx.qFouille() && ctx.qFouille().resolue===true);

  T('rien n a été perdu en chemin', ctx.etat.credits===soldeAvantExtraction);

  /* --- extraction : la dette s'éteint, une seule fois --- */
  const piecesAvant=Object.values(ctx.etat.collection).reduce((a,b)=>a+b,0);
  ctx.tirage();
  const piecesApres=Object.values(ctx.etat.collection).reduce((a,b)=>a+b,0);
  T('l extraction livre une pièce', piecesApres===piecesAvant+1,
    piecesAvant+' → '+piecesApres);
  T('l extraction éteint la dette', ctx.etat.fouilleEnCours===null);
  ctx.tirage(); ctx.tirage();
  const piecesFin=Object.values(ctx.etat.collection).reduce((a,b)=>a+b,0);
  T('un double-tap sur Extraire ne livre pas deux pièces', piecesFin===piecesApres,
    piecesApres+' → '+piecesFin);

  /* --- même verrou sur la tranchée stérile --- */
  ctx.setSite(site);
  ctx.fouiller();
  const q2=(ctx.qFouille()||{}).q;
  T('une nouvelle fouille repose une question', !!q2);
  const faux=q2 ? q2.choix.find(c=>c!==q2.r) : 'x';
  const btn=()=>({classList:{add(){}}, disabled:false});
  for(let k=0;k<ctx.NB_ESSAIS;k++) ctx.repFouille(faux, btn());
  T('deux ratés ferment la question', !!ctx.qFouille() && ctx.qFouille().resolue===true);
  T('une question ratée reste due', !!ctx.etat.fouilleEnCours
    && ctx.etat.fouilleEnCours.statut==='sterile');
  const av=Object.values(ctx.etat.collection).reduce((a,b)=>a+b,0);
  ctx.trancheeSterile(); ctx.trancheeSterile();
  const ap=Object.values(ctx.etat.collection).reduce((a,b)=>a+b,0);
  T('la tranchée stérile ne se referme qu une fois', ap-av<=1, av+' → '+ap);
  T('la tranchée stérile éteint la dette', ctx.etat.fouilleEnCours===null);

  /* --- dette inhonorable : remboursement plutôt que perte --- */
  ctx.setSite(site);
  const soldeAv=ctx.etat.credits;
  ctx.fouiller();
  if(ctx.etat.fouilleEnCours) ctx.etat.fouilleEnCours.qid='QUESTION-QUI-N-EXISTE-PLUS';
  ctx.sauver();
  ctx=charger();
  const rembourse=ctx.reprendreFouille();
  T('une dette inhonorable ne rouvre pas de tranchée', rembourse===false);
  T('une dette inhonorable est remboursée', ctx.etat.credits===soldeAv,
    ctx.etat.credits+' vs '+soldeAv);
  T('une dette inhonorable est effacée', ctx.etat.fouilleEnCours===null);

  /* --- on ne paie pas deux fouilles à la fois --- */
  ctx.setSite(site);
  ctx.fouiller();
  const s1=ctx.etat.credits;
  ctx.fouiller();
  T('une seule tranchée ouverte à la fois', ctx.etat.credits===s1);
  /* Solder la dette avant de sortir : elle est PERSISTANTE — c'est tout
     l'objet de ce fichier — donc la laisser ouverte contaminerait la section
     suivante à travers son rechargement. */
  const qz=(ctx.qFouille()||{}).q;
  if(qz){ ctx.repFouille(qz.r,{classList:{add(){}},disabled:false}); ctx.tirage(); }
  T('section 4 sort sans dette', ctx.etat.fouilleEnCours===null);
}

/* =================================================================
   5. FRONTIÈRE DE PROFIL
   `etat` est rechargé à chaque bascule, mais mission, fouille et leçon
   vivaient hors de lui : une partie commencée sur A se poursuivait sur B,
   gains et maîtrise inscrits sur la mauvaise progression. Le correctif
   (resetSessionTransitoire) est dans l'arbre depuis v107 — sans une seule
   assertion. C'est le schéma exact du bug des niveaux : un correctif que
   personne ne rejoue est un correctif qui peut disparaître sans bruit.
   ================================================================= */
if(P && site){
  ctx=charger();
  /* `ctx.etat` est figé au chargement ; basculerProfil RÉASSIGNE la variable
     module. Toute lecture d'état après une bascule doit passer par le getter,
     sous peine de mesurer le fantôme du profil précédent — c'est précisément
     la confusion que cette section teste chez l'application. */
  const E=()=>ctx.getEtat();
  const idA=ctx.registre.actif;

  /* --- une mission ne traverse pas la bascule --- */
  ctx.lancerNiveau(P.id,0);
  T('mission ouverte sur A', !!ctx.mission() && !!ctx.mission().q);
  ctx.creerProfil('B-test');
  const idB=ctx.registre.actif;
  T('le profil B est actif', idB!==idA);
  T('la mission de A ne traverse pas', ctx.mission()===null);
  T('le pack actif de A ne traverse pas', ctx.packActif()===null);
  T('le niveau actif de A ne traverse pas', ctx.niveauActif()===null);

  /* --- les gains d'une mission jouée sur B restent sur B --- */
  const creditsB0=E().credits;
  jouerNiveau(P.id,0);
  const gainB=E().credits-creditsB0;
  T('une mission jouée sur B paie B', gainB>0, '+'+gainB+' ◈');
  ctx.basculerProfil(idA);
  T('retour sur A : la maîtrise de B n a pas déteint',
    !ctx.niveauAcquis(P.id,0) || JSON.stringify(ctx.prog(P.id).c)!=='{}');
  const cA=ctx.prog(P.id).c;
  ctx.basculerProfil(idB);
  const cB=ctx.prog(P.id).c;
  T('progressions de A et B distinctes en mémoire', cA!==cB);

  /* --- une fouille payée sur A est due à A, pas à B --- */
  ctx.basculerProfil(idA);
  ctx.setSite(site);
  E().credits=Math.max(E().credits, 1000); ctx.sauver();
  const soldeA=E().credits;
  ctx.fouiller();
  T('fouille ouverte sur A', !!E().fouilleEnCours);
  ctx.basculerProfil(idB);
  T('la dette de A ne traverse pas', !E().fouilleEnCours);
  T('la tranchée de A n est pas ouverte sur B', ctx.qFouille()===null);
  ctx.basculerProfil(idA);
  T('au retour, la dette de A est reprise : tranchée rouverte',
    !!ctx.qFouille() && !!E().fouilleEnCours);
  T('reprise sans re-paiement', E().credits===soldeA-ctx.COUT_FOUILLE,
    E().credits+' vs '+(soldeA-ctx.COUT_FOUILLE));
  /* solder proprement pour la suite */
  const qA=ctx.qFouille().q;
  ctx.repFouille(qA.r,{classList:{add(){}},disabled:false});
  ctx.tirage();
  T('la dette de A est soldée', E().fouilleEnCours===null);
}

/* =================================================================
   6. PRIME PROPORTIONNELLE — quanta1 garde ses 20 questions, la
   récompense suit (150 × banque / 6). Décision v109.
   ================================================================= */
{
  const q1=ctx.PACKS.find(p=>p.id==='quanta1');
  T('quanta1 existe avec ses banques longues',
    !!q1 && q1.niveaux.every(n=>n.bank().length===20));
  if(q1){
    T('prime quanta1 alignée sur la banque', ctx.primeDe(q1,0)===500,
      String(ctx.primeDe(q1,0)));
  }
  if(P) T('prime des niveaux ordinaires inchangée', ctx.primeDe(P,0)===ctx.PRIME_NIVEAU,
    String(ctx.primeDe(P,0)));
}

/* =================================================================
   7. IDENTITÉ DES ENTRÉES DE CARNET
   Prérequis de la sauvegarde en ligne, et bug local en soi. `t` est un
   Date.now() en millisecondes : plusieurs entrées naissent dans la même, si
   bien que « Retirer » pouvait effacer la voisine. Côté serveur, dédoublonner
   sur `t` aurait détruit un tiers des notes à la première synchronisation.
   ================================================================= */
{
  ctx=charger();
  const E=()=>ctx.getEtat();
  const site7=siteJouable(ctx);
  const P7=ctx.PACKS.find(p=>p.niveaux && p.niveaux[0].bank().length===ctx.NB_MISSION);

  /* Fabriquer du carnet par les deux chemins : missions et fouilles. */
  E().credits=9000; ctx.sauver();
  for(let r=0;r<4;r++){
    ctx.lancerNiveau(P7.id,0);
    for(let k=0;k<ctx.NB_MISSION;k++){
      const m=ctx.mission(); if(!m||!m.q) break;
      ctx.repondre(m.q.r); ctx.suite();
    }
  }
  for(let r=0;r<8;r++){
    ctx.setSite(site7); ctx.fouiller();
    const qf=ctx.qFouille(); if(!qf) break;
    ctx.repFouille(qf.q.r,{classList:{add(){}},disabled:false}); ctx.tirage();
  }
  const c=E().carnet||[];
  T('le carnet s est rempli', c.length>10, c.length+' entrées');
  T('toute entrée porte un eid', c.every(e=>typeof e.eid==='string' && e.eid.length));
  T('tous les eid sont distincts', new Set(c.map(e=>e.eid)).size===c.length,
    new Set(c.map(e=>e.eid)).size+' / '+c.length);
  /* Le fait qui motive tout : les horodatages, eux, ne le sont pas. */
  const tsDistincts=new Set(c.map(e=>e.t)).size;
  T('des entrées partagent bien un horodatage — d où l eid',
    tsDistincts<c.length, tsDistincts+' horodatages pour '+c.length+' entrées');
  T('les eid ne contiennent que des caractères sûrs pour un attribut onclick',
    c.every(e=>/^[a-z0-9:_-]+$/i.test(e.eid)), (c.find(e=>!/^[a-z0-9:_-]+$/i.test(e.eid))||{}).eid);

  /* Suppression : la bonne entrée part, et elle est enterrée. */
  /* Viser le SECOND d'une paire d'horodatage, jamais le premier : sur le
     premier, l'ancienne recherche par `t` tombait par chance sur la bonne
     entrée et le bug restait invisible. */
  const cible=c.find((e,i)=>c.findIndex(x=>x.t===e.t)<i) || c[0];
  T('le cas de test vise bien un jumeau non premier',
    c.findIndex(x=>x.t===cible.t)!==c.indexOf(cible));
  const avant=c.length, autres=c.filter(e=>e.eid!==cible.eid).map(e=>e.eid);
  ctx.carnetSupprimer(cible.eid);
  const apres=E().carnet;
  T('retirer une entrée en retire exactement une', apres.length===avant-1);
  T('retirer retire la BONNE entrée', !apres.some(e=>e.eid===cible.eid));
  T('les entrées de même horodatage survivent au retrait',
    autres.every(id=>apres.some(e=>e.eid===id)));
  T('l entrée retirée est enterrée', (E().carnetTombes||[]).includes(cible.eid));

  /* Migration d'un carnet hérité : déterministe, sans doublon ni collision. */
  const herite={carnet:[{k:'note',t:100,note:'a'},{k:'note',t:100,note:'b'},
                        {k:'note',t:200,note:'c'}]};
  const m1=ctx.normaliser(JSON.parse(JSON.stringify(herite)));
  const m2=ctx.normaliser(JSON.parse(JSON.stringify(herite)));
  T('un carnet hérité reçoit des eid', m1.carnet.every(e=>!!e.eid));
  T('les eid hérités sont distincts', new Set(m1.carnet.map(e=>e.eid)).size===3,
    JSON.stringify(m1.carnet.map(e=>e.eid)));
  T('la migration est déterministe',
    JSON.stringify(m1.carnet.map(e=>e.eid))===JSON.stringify(m2.carnet.map(e=>e.eid)));
  T('le premier eid hérité vaut le repli du serveur',
    m1.carnet[0].eid==='legacy:100');
  T('carnetTombes existe après normalisation', Array.isArray(m1.carnetTombes));
}

/* ---- Sortie ---- */
console.log('');
console.log('  RÉUSSITES ('+ok+')');
echecs.forEach(e=>console.log('   \u2717 '+e));
console.log('  ÉCHECS ('+echecs.length+')');
process.exit(echecs.length?1:0);
