/* Porte « machine à états ».
   Les 13 000 assertions de qc.js vérifient les DONNÉES et les chemins heureux.
   Elles n'ont pas vu que la maîtrise des niveaux ne s'enregistrait jamais, ni
   qu'un retour dans la Bourse remplaçait la question en cours. Ce harnais joue
   donc de vraies transitions : un niveau entier, deux fois de suite, un détour
   par un autre onglet au milieu, une bascule de profil pendant une mission.

   Il ne teste PAS des chaînes de caractères dans le source : il fait tourner
   app.js et regarde l'état obtenu. */
const fs=require('fs');
const el=()=>({classList:{add(){},remove(){},toggle(){},contains(){return false}},
  removeAttribute(){}, setAttribute(){}, disabled:false, set src(v){},
  style:{}, dataset:{}, set textContent(v){this._t=v}, get textContent(){return this._t||''},
  set innerHTML(v){this._h=v}, get innerHTML(){return this._h||''},
  addEventListener(){}, appendChild(){}, querySelector(){return el()},
  querySelectorAll(){return []}, focus(){}, scrollTo(){}, select(){},
  getBoundingClientRect(){return {width:360,height:640}}});
const store={};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},
  location:{href:'',reload(){}},scrollTo(){}};
global.localStorage=window.localStorage;
global.document={getElementById:()=>el(),querySelector:()=>el(),querySelectorAll:()=>[],
  createElement:()=>el(),body:el(),documentElement:el(),addEventListener(){},
  readyState:'complete'};
global.navigator={serviceWorker:{register(){return Promise.resolve()},getRegistrations(){return Promise.resolve([])}},onLine:true};
global.fetch=()=>Promise.resolve({json:()=>Promise.resolve({})});
global.setTimeout=(f)=>{try{f()}catch(e){}; return 0};
global.clearInterval=()=>{}; global.setInterval=()=>0;
global.requestAnimationFrame=f=>{try{f(0)}catch(e){}; return 0};
global.crypto={randomUUID:()=>'u'+Math.random().toString(36).slice(2)};
global.Image=function(){ return {set src(v){}, addEventListener(){}, onload:null, onerror:null}; };
global.Audio=function(){ return {play(){}, pause(){}, addEventListener(){}}; };

const R=require('path').join(__dirname,'..');
const src=fs.readFileSync(R+'/data.js','utf8')+'\n'+fs.readFileSync(R+'/app.js','utf8');
const X={};
/* Object.assign INVOQUE les getters de la source : les exposer ainsi aurait
   figé l'état à sa valeur de chargement (mission = null pour toujours). Les
   variables de session doivent passer par de vrais accesseurs. */
const EXPOSE=`;Object.assign(this,{
  PACKS, SEUIL_MAITRISE, PRIME_NIVEAU, NB_MISSION,
  prog, montrer, lancerNiveau, niveauAcquis, cleNiveau, repondre, suite,
  basculerProfil, creerProfil, enregistrerNiveaux, resetSessionTransitoire
});
Object.defineProperties(this,{
  etat:{get:()=>etat}, registre:{get:()=>registre},
  mission:{get:()=>mission}, packActif:{get:()=>packActif},
  niveauActif:{get:()=>niveauActif}
});`;
try{ new Function(src+EXPOSE).call(X); }
catch(e){ console.log('  chargement : ÉCHEC —', e.message); process.exit(1); }
X.enregistrerNiveaux();

let ok=0, ko=0;
function T(nom, cond, detail){
  if(cond){ ok++; console.log('   \u2713 '+nom+(detail?' — '+detail:'')); }
  else    { ko++; console.log('   \u2717 '+nom+(detail?' — '+detail:'')); }
}

/* Un pack à niveaux quelconque : la garantie ne doit dépendre d'aucun contenu. */
const P = X.PACKS.find(p=>p.niveaux && p.niveaux.length>=2);

/* Joue un niveau de bout en bout, toutes réponses justes du premier coup. */
function jouerNiveau(i){
  X.lancerNiveau(P.id, i);
  for(let k=0; k<X.NB_MISSION; k++){
    const q=X.mission && X.mission.q;
    if(!q) break;
    X.repondre(q.r);
    X.suite();
  }
}

/* ---- 1. Un niveau se termine réellement ------------------------------- */
console.log('\n  1. Acquisition d\'un niveau ('+P.id+')');
const bank0=P.niveaux[0].bank();
jouerNiveau(0);
const c=X.prog(P.id).c;
T('les six questions portent une clé de maîtrise',
  bank0.every(q=>c[X.cleNiveau(0,q.n)]===1),
  Object.keys(c).length+' clés après un passage');
T('un seul passage ne suffit pas (seuil '+X.SEUIL_MAITRISE+')', !X.niveauAcquis(P.id,0));

const soldeAvant=X.etat.credits;
jouerNiveau(0);
T('niveau acquis après deux passages parfaits', X.niveauAcquis(P.id,0));
T('prime versée une fois', X.etat.credits - soldeAvant > X.PRIME_NIVEAU,
  '+'+(X.etat.credits-soldeAvant)+' \u25C8 (gains + prime '+X.PRIME_NIVEAU+')');
T('achèvement enregistré', !!(X.etat.niveauxFinis||{})[P.id+':0']);

const solde2=X.etat.credits;
jouerNiveau(0);
T('rejouer un niveau acquis ne reverse pas la prime',
  X.etat.credits - solde2 < X.PRIME_NIVEAU);

/* ---- 2. Aucune fuite d'un niveau vers le suivant ----------------------- */
console.log('\n  2. Étanchéité entre niveaux');
T('le niveau 1 n\'est pas acquis par ricochet', !X.niveauAcquis(P.id,1));
const communs = P.niveaux[0].bank().map(q=>q.n)
  .filter(n => P.niveaux[1].bank().some(q=>q.n===n));
T('les numéros de question sont bien partagés entre niveaux', communs.length>0,
  communs.length+' numéros identiques — la clé doit donc porter le rang du niveau');
T('les clés, elles, sont disjointes',
  !P.niveaux[1].bank().some(q=>c[X.cleNiveau(1,q.n)]>0));

/* ---- 3. QCM : les leurres du niveau sont utilisés ---------------------- */
console.log('\n  3. Forme des questions de niveau');
X.lancerNiveau(P.id, 1);
const q1=X.mission.q;
T('la question porte des propositions', Array.isArray(q1.choix) && q1.choix.length>=3,
  q1.choix ? q1.choix.length+' propositions' : 'AUCUNE — saisie libre imposée');
T('la bonne réponse est dans les propositions', !!q1.choix && q1.choix.includes(q1.r));
T('la question porte un indice', !!q1.indice);

/* ---- 4. Interruption : un détour ne change pas la question ------------- */
console.log('\n  4. Détour par un autre onglet');
const avantQ=X.mission.q, avantI=X.mission.i;
X.montrer('carnet'); X.montrer('bourse');
T('question inchangée après un aller-retour', X.mission.q===avantQ,
  X.mission.q===avantQ ? '' : 'la question a été remplacée');
T('rang de mission inchangé', X.mission.i===avantI);

X.repondre('réponse manifestement fausse');
T('un essai raté est comptabilisé', X.mission.essais===1);
X.montrer('collection'); X.montrer('bourse');
T('les essais survivent au détour', X.mission.essais===1 && X.mission.q===avantQ,
  X.mission.essais===1 ? '' : 'essais remis à '+X.mission.essais+' : reroll gratuit');

X.repondre(avantQ.r);
T('question résolue', X.mission.resolue===true);
const gagne=X.mission.gagne;
X.montrer('carnet'); X.montrer('bourse');
T('la mission reste résolue après le détour', X.mission.resolue===true,
  X.mission.resolue ? '' : 'soft-lock : réponses actives mais ignorées');
T('aucun gain fantôme', X.mission.gagne===gagne);

/* ---- 5. Statistique « du premier coup » ------------------------------- */
console.log('\n  5. Honnêteté du compteur');
T('une réussite après un raté ne compte pas comme « du premier coup »',
  X.mission.justes===0, 'justes = '+X.mission.justes);

/* ---- 6. Frontière de profil ------------------------------------------- */
console.log('\n  6. Bascule de profil en pleine mission');
X.lancerNiveau(P.id, 1);
T('mission en cours avant bascule', !!X.mission);
X.creerProfil('Témoin');
T('la mission ne traverse pas la frontière', X.mission===null,
  X.mission===null ? '' : 'mission encore active sur le nouveau profil');
T('le pack actif est relâché', X.packActif===null);
T('le niveau actif est relâché', X.niveauActif===null);
T('la progression du nouveau profil est vierge',
  Object.keys(X.prog(P.id).c||{}).length===0,
  Object.keys(X.prog(P.id).c||{}).length+' clés');

console.log('\n  RÉUSSITES ('+ok+')');
console.log('  ÉCHECS ('+ko+')\n');
process.exit(ko?1:0);
