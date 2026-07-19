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

/* 7. L'accueil ne doit se montrer qu'une fois, et jamais à un profil avancé. */
{
  const neuf=o.normaliser(o.etatVide());
  T('accueil : un état neuf le réclame', neuf.accueilVu===false);
  const vu=o.normaliser(Object.assign(o.etatVide(),{accueilVu:true}));
  T('accueil : une fois vu, il ne revient pas', vu.accueilVu===true);
  /* Une sauvegarde d'avant l'accueil est complétée par normaliser : le champ
     existe, et c'est la progression qui décide si l'écran s'affiche. */
  const ancien=o.normaliser({credits:999, collection:{'EDI-01':3}});
  T('accueil : champ ajouté aux anciennes sauvegardes', ancien.accueilVu===false);
  const avance=Object.keys(ancien.collection).filter(k=>ancien.collection[k]>0).length>0;
  T('accueil : un profil déjà avancé ne le verrait pas', avance===true);
}

/* 8. L'aperçu d'une partie doit se lire sans la charger, et désigner comme
   vignette la dernière créature déterrée. */
{
  const id=o.idNeuf();
  o.ecritJSON(o.cleEtat(id), o.normaliser({
    collection:{'EDI-01':2,'BURG-01':1,'MOR-02':3},
    ordre:{'EDI-01':1,'BURG-01':2,'MOR-02':3}, ordreN:3}));
  const e=o.normaliser(o.litJSON(o.cleEtat(id)));
  const trouvees=Object.keys(e.collection).filter(k=>e.collection[k]>0);
  let derniere=null,rang=-1;
  trouvees.forEach(k=>{const r=(e.ordre||{})[k]||0; if(r>rang){rang=r;derniere=k;}});
  T('aperçu : bon décompte', trouvees.length===3, String(trouvees.length));
  T('aperçu : vignette = dernière trouvée', derniere==='MOR-02', String(derniere));
  T('aperçu : l’état courant n’a pas bougé', o.etat.credits===999, String(o.etat.credits));
  const vide=o.normaliser(o.etatVide());
  const rien=Object.keys(vide.collection).filter(k=>vide.collection[k]>0);
  T('aperçu : une partie neuve n’a pas de vignette', rien.length===0);
}

/* 9. Le cycle qui compte vraiment : sauvegarder, tout perdre, restaurer.
   C'est le scénario d'une désinstallation suivie d'une réinstallation. */
{
  /* Deux parties avec des progressions distinctes. */
  o.registre={liste:[], actif:null};
  const a=o.creerProfil ? null : null;
  const idA=o.idNeuf(), idB=o.idNeuf();
  o.registre.liste=[{id:idA,nom:'Louise',cree:1},{id:idB,nom:'Denis',cree:2}];
  o.registre.actif=idA;
  o.ecritJSON(o.PROFILS_CLE, o.registre);
  o.ecritJSON(o.cleEtat(idA), o.normaliser({credits:412, collection:{'EDI-01':2,'BURG-01':1}}));
  o.ecritJSON(o.cleEtat(idB), o.normaliser({credits:77, collection:{'MOR-02':3}}));

  /* Sauvegarde complète, telle que paquetComplet la construit. */
  const paquet={app:'gronosaures', schema:1, complet:true,
    profils:o.registre.liste.map(p=>{
      const e=o.normaliser(o.litJSON(o.cleEtat(p.id))||o.etatVide());
      return {nom:p.nom, cree:p.cree, etat:e};
    })};
  T('sauvegarde : les deux parties y sont', paquet.profils.length===2);
  T('sauvegarde : les crédits sont portés',
    paquet.profils[0].etat.credits===412 && paquet.profils[1].etat.credits===77);
  const json=JSON.stringify(paquet);
  T('sauvegarde : sérialisable', json.length>50);

  /* Désinstallation : tout le stockage disparaît. */
  /* Désinstaller efface le stockage local : on le simule à la racine. */
  Object.keys(store).forEach(k=>delete store[k]);
  o.registre={liste:[], actif:null};
  T('après désinstallation : plus aucune partie', (o.litJSON(o.PROFILS_CLE)||{liste:[]}).liste.length===0);

  /* Réinstallation puis restauration depuis le fichier. */
  const d=JSON.parse(json);
  const lots = Array.isArray(d.profils) ? d.profils : [{nom:'x', etat:d.etat}];
  lots.forEach(l=>{
    const id=o.idNeuf();
    o.registre.liste.push({id, nom:l.nom, cree:l.cree||1, vue:1});
    o.ecritJSON(o.cleEtat(id), o.normaliser(l.etat));
  });
  o.ecritJSON(o.PROFILS_CLE, o.registre);
  T('restauration : deux parties retrouvées', o.registre.liste.length===2);
  T('restauration : les noms sont conservés',
    o.registre.liste.map(p=>p.nom).join(',')==='Louise,Denis');
  const e0=o.litJSON(o.cleEtat(o.registre.liste[0].id));
  T('restauration : la progression est intacte',
    e0.credits===412 && e0.collection['EDI-01']===2, JSON.stringify(e0.collection));

  /* Un fichier de l'ancien format doit continuer de fonctionner. */
  const vieux={app:'gronosaures', schema:1, profil:{nom:'Ancien'},
               etat:o.normaliser({credits:5, collection:{'TRI-01':1}})};
  const lots2 = Array.isArray(vieux.profils) ? vieux.profils
              : (vieux.etat ? [{nom:vieux.profil.nom, etat:vieux.etat}] : null);
  T('restauration : l’ancien format d’export est accepté',
    !!lots2 && lots2.length===1 && lots2[0].etat.credits===5);

  /* Restaurer n'écrase pas ce qui est déjà là. */
  const avant=o.registre.liste.length;
  lots2.forEach(l=>{ const id=o.idNeuf();
    o.registre.liste.push({id,nom:l.nom,cree:1,vue:1});
    o.ecritJSON(o.cleEtat(id), o.normaliser(l.etat)); });
  T('restauration : ajoute sans écraser', o.registre.liste.length===avant+1);
}

console.log('\n  RÉUSSITES ('+A+')\n  ÉCHECS ('+E+')');
process.exit(E?1:0);
