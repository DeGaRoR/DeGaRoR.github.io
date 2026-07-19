/* tools/profils_test.js — éprouve la couche de profils hors navigateur.
   localStorage est simulé ; on ne charge d'app.js que la partie antérieure à
   l'amorçage DOM, qui suffit pour la persistance et l'échange de progression. */
const fs=require('fs'), path=require('path');
const R=path.resolve(__dirname,'..');
const store={};
global.localStorage={getItem:k=>(k in store?store[k]:null),
  setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];}};
global.toast=()=>{};
global.document={createElement:()=>({click(){},remove(){},style:{}}),
  body:{appendChild(){}}, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[]};
global.window={addEventListener(){}};

const src=fs.readFileSync(path.join(R,'data.js'),'utf8')+fs.readFileSync(path.join(R,'app.js'),'utf8');
const coupe=src.lastIndexOf('\ndocument.addEventListener');
if(coupe<0){ console.log('   \u2717 amorçage introuvable dans app.js'); process.exit(1); }
const partie=src.slice(0, coupe);
const EXPORTS=';Object.assign(this,{registre,etat,profilActif,paquetProgression,'
  +'normaliser,etatVide,litJSON,ecritJSON,cleEtat,idNeuf,PROFILS_CLE,ATLAS_CLE,'
  +'CREATURES,SITES,trouvees});';

let A=0,E=0;
const T=(n,c,d)=>{ if(c){A++;} else {E++; console.log('   \u2717 '+n+(d?' \u2014 '+d:''));} };

/* 1. Une progression d'avant les profils doit devenir le premier profil. */
store[ 'atlas_temps_profond_v1' ]=JSON.stringify({credits:999,collection:{'EDI-01':3},fouilles:7});
const o={}; new Function(partie+EXPORTS).call(o);
T('migration : un profil est créé', o.registre.liste.length===1, String(o.registre.liste.length));
T('migration : les crédits sont repris', o.etat.credits===999, String(o.etat.credits));
T('migration : la collection est reprise', o.etat.collection['EDI-01']===3);
T('migration : l’ancienne clé est conservée', store[o.ATLAS_CLE]!==undefined);
T('migration : les champs absents sont comblés', o.etat.tri==='chantier' && typeof o.etat.qSite==='object');
T('migration : un profil actif est désigné', !!o.profilActif());

/* 2. Un second chargement ne doit rien recréer ni rien perdre. */
const o2={}; new Function(partie+EXPORTS).call(o2);
T('registre stable au rechargement', o2.registre.liste.length===1 && o2.etat.credits===999);
T('identifiant de profil stable', o2.registre.actif===o.registre.actif);

/* 3. Le paquet d'export doit se suffire à lui-même. */
const p=o.paquetProgression();
T('export : signature de l’application', p.app==='gronosaures');
T('export : numéro de schéma', p.schema===1);
T('export : état complet embarqué', p.etat.credits===999);
T('export : résumé cohérent', p.resume.total===o.CREATURES.length);
T('export : horodatage ISO', /^\d{4}-\d\d-\d\dT/.test(p.exporte));
T('export : nom du profil', typeof p.profil.nom==='string' && p.profil.nom.length>0);
T('export : sérialisable sans perte', (()=>{ try{
  return JSON.parse(JSON.stringify(p)).etat.credits===999; }catch(e){ return false; } })());

/* 4. Deux profils ne doivent jamais partager d'état. */
const id2=o.idNeuf();
o.registre.liste.push({id:id2,nom:'Deux',cree:1,vue:1});
o.ecritJSON(o.cleEtat(id2), Object.assign(o.etatVide(),{credits:12}));
o.ecritJSON(o.PROFILS_CLE, o.registre);
const a=o.litJSON(o.cleEtat(o.registre.liste[0].id)), b=o.litJSON(o.cleEtat(id2));
T('les profils sont isolés', a.credits===999 && b.credits===12, a.credits+' / '+b.credits);
T('une clé d’état par profil',
  Object.keys(store).filter(k=>k.indexOf('atlas_etat_')===0).length===2);

/* 5. L'import doit refuser tout ce qui n'est pas un export de l'atlas. */
const valide=d=>!!(d && d.app==='gronosaures' && d.etat && !(d.schema>1));
const mauvais=[null,{},{app:'autre',etat:{}},{app:'gronosaures'},
               {app:'gronosaures',etat:{},schema:99},{etat:{credits:1}}];
T('les fichiers étrangers sont rejetés', mauvais.every(d=>!valide(d)));
T('un export de l’atlas est accepté', valide(p));
T('un export relu reste valide', valide(JSON.parse(JSON.stringify(p))));

/* 6. Un état importé doit être normalisé, jamais adopté tel quel. */
const partiel=o.normaliser({credits:5});
T('import : état partiel complété', partiel.tri==='chantier' && typeof partiel.collection==='object');
T('import : valeur fournie préservée', partiel.credits===5);

console.log('\n  RÉUSSITES ('+A+')\n  ÉCHECS ('+E+')');
process.exit(E?1:0);
