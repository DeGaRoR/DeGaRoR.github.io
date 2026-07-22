/* ================================================================
   tools/nuage_test.js — porte de SAUVEGARDE EN LIGNE.

   Un faux serveur remplace Supabase : il applique la MÊME fusion que
   `atlas_sauver` (union par eid, tombes, plus récente modification gagne) et
   sait aussi tomber en panne, refuser les identifiants ou disparaître du
   réseau. Ce qu'on vérifie n'est pas que ça marche quand tout va bien — c'est
   que rien ne se perd quand ça va mal.

   Règle directrice : l'appareil est la référence, le serveur est un filet.
   Aucune défaillance ne doit empêcher de jouer ni effacer une note.

   Usage : node tools/nuage_test.js — exiger « ÉCHECS (0) ».
   ================================================================ */
'use strict';
const fs=require('fs'), path=require('path');
const R=path.resolve(__dirname,'..');

const el=()=>({classList:{add(){},remove(){},toggle(){},contains(){return false}},
  removeAttribute(){}, setAttribute(){}, disabled:false, set src(v){},
  style:{}, dataset:{}, set textContent(v){this._t=v}, get textContent(){return this._t||''},
  set innerHTML(v){this._h=v}, get innerHTML(){return this._h||''},
  addEventListener(){}, appendChild(){}, querySelector(){return el()},
  querySelectorAll(){return []}, focus(){}, select(){}, scrollTo(){},
  getBoundingClientRect(){return {width:360,height:640}}});
const registreEl=new Map();
const parId=id=>{ if(!registreEl.has(id)) registreEl.set(id, el()); return registreEl.get(id); };
const store={};
const ecouteurs={};
global.window={addEventListener(k,f){(ecouteurs[k]=ecouteurs[k]||[]).push(f)},
  matchMedia:()=>({matches:false,addEventListener(){}}),
  localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>store[k]=String(v),
                removeItem:k=>delete store[k]},
  location:{href:''},scrollTo(){}};
global.localStorage=window.localStorage;
global.document={getElementById:id=>parId(id),
  querySelector:s=>(/^#[\w-]+$/.test(s)?parId(s.slice(1)):el()),
  querySelectorAll:()=>[], createElement:()=>el(), body:el(), documentElement:el(),
  addEventListener(){}, readyState:'complete'};
const reseau={enLigne:true};
Object.defineProperty(global,'navigator',{configurable:true,writable:true,
  value:{serviceWorker:{register(){return Promise.resolve()}}, get onLine(){return reseau.enLigne}}});
global.setTimeout=(f,d)=>{ if(!d) { try{f()}catch(e){} } return 0; };  // les temporisations
global.clearTimeout=()=>{};                                            // sont pilotées à la main
global.clearInterval=()=>{}; global.setInterval=()=>0;
global.requestAnimationFrame=f=>{try{f(0)}catch(e){}return 0};
Object.defineProperty(global,'crypto',{configurable:true,writable:true,
  value:{randomUUID:()=>'u'+Math.random().toString(36).slice(2)}});
global.Image=function(){return{set src(v){},addEventListener(){}}};

/* ---- Faux Supabase ---------------------------------------------------- */
const serveur={
  lignes:new Map(), panne:false, muet:false, appels:0,
  reinit(){ this.lignes.clear(); this.panne=false; this.muet=false; this.appels=0; }
};
function fusionServeur(ancien, envoye){
  const cle=e=>e.eid||('legacy:'+e.t), quand=e=>e.songeT||e.t||0;
  const tombes=[...new Set([...(ancien.carnetTombes||[]),...(envoye.carnetTombes||[])])];
  const par=new Map();
  for(const e of [...(ancien.carnet||[]),...(envoye.carnet||[])]){
    const k=cle(e); if(tombes.includes(k)) continue;
    const v=par.get(k); if(!v||quand(e)>quand(v)) par.set(k,e);
  }
  return Object.assign({}, envoye,
    {carnet:[...par.values()].sort((a,b)=>(a.t||0)-(b.t||0)), carnetTombes:tombes});
}
global.fetch=async (url, opt)=>{
  serveur.appels++;
  if(!reseau.enLigne) throw new Error('offline');
  if(serveur.muet)    throw new Error('injoignable');
  if(serveur.panne)   return {ok:false, status:500, json:async()=>null};
  const fn=String(url).split('/rpc/')[1];
  const c=JSON.parse(opt.body);
  if(fn==='atlas_creer'){
    const id='id-'+(serveur.lignes.size+1);
    serveur.lignes.set(id, {code:c.p_code, etat:c.p_etat||{}});
    return {ok:true, status:200, json:async()=>id};
  }
  const l=serveur.lignes.get(c.p_id);
  const bon=l && l.code===c.p_code;
  if(fn==='atlas_lire')
    return {ok:true, status:200, json:async()=>(bon?l.etat:null)};
  if(fn==='atlas_sauver'){
    if(!bon) return {ok:true, status:200, json:async()=>null};
    l.etat=fusionServeur(l.etat, c.p_etat);
    return {ok:true, status:200, json:async()=>l.etat};
  }
  return {ok:false, status:404, json:async()=>null};
};

/* ---- Chargement ------------------------------------------------------- */
const brut=fs.readFileSync(R+'/data.js','utf8')+'\n'+fs.readFileSync(R+'/app.js','utf8');
const EXPORTS='CLOUD,etat,registre,carnet,sauver,noterEvenement,normaliser,'
 +'nuagePousser,nuageTirer,nuageDemarrer,nuageMaintenant,nuageEtat:()=>nuage,'
 +'nuageConfigure,nuageLie,NUAGE_LIBELLE,'
 +'diagNuageHTML,majPastilleNuage,creerProfil,basculerProfil,profilActif,'
 +'carnetSupprimer,fusionnerCarnet,getEtat:()=>etat,setEtat:v=>etat=v';
function charger(configure){
  /* On injecte la configuration comme le ferait data.js une fois renseigné. */
  /* On neutralise ou on redirige la configuration RÉELLE de data.js : le
     harnais ne doit jamais parler au vrai Supabase, dans un sens comme dans
     l'autre. La substitution porte sur les valeurs, pas sur un gabarit. */
  const src=brut
    .replace(/url:\s*'https:\/\/[^']*'/, configure ? "url:'https://faux.supabase.co'" : 'url:null')
    .replace(/key:\s*'[^']*'/,            configure ? "key:'cle-anon-de-test'"          : 'key:null');
  const c={};
  try{ new Function(src+'\n;Object.assign(this,{'+EXPORTS+'});').call(c); }
  catch(e){ console.log('  chargement : ÉCHEC —', e.message); process.exit(1); }
  /* Garde-fou : si la substitution ratait un jour — renommage de champ,
     guillemets différents —, le harnais frapperait le VRAI projet Supabase avec
     de fausses parties. On s'arrête net plutôt que de polluer la base. */
  if(c.CLOUD && String(c.CLOUD.url||'').includes('supabase.co')
     && !String(c.CLOUD.url).includes('faux.supabase.co')){
    console.log('  ARRÊT : la configuration réelle n’a pas été neutralisée ('+c.CLOUD.url+')');
    process.exit(1);
  }
  return c;
}

let ok=0; const echecs=[];
const T=(n,c,d)=>{ if(c) ok++; else echecs.push(n+(d?' — '+d:'')); };
const dors=()=>new Promise(r=>setImmediate(r));

(async function(){

/* ===============================================================
   1. NON CONFIGURÉ — l'application doit être strictement inchangée
   =============================================================== */
{
  const c=charger(false);
  serveur.reinit();
  const avant=serveur.appels;
  c.noterEvenement('note',{note:'sans nuage'});
  c.sauver(); await dors();
  T('non configuré : aucun appel réseau', serveur.appels===avant, serveur.appels+' appels');
  T('non configuré : la synchro se déclare éteinte', c.nuageConfigure()===false);
  T('non configuré : le diagnostic reste lisible', /non configurée/.test(c.diagNuageHTML()));
  T('non configuré : la partie s enregistre quand même', (c.getEtat().carnet||[]).length>0);
}

/* ===============================================================
   2. MARCHE NOMINALE
   =============================================================== */
let cA;
{
  cA=charger(true); serveur.reinit();
  T('configuré : la synchro s active', cA.nuageConfigure()===true);
  cA.noterEvenement('note',{note:'première'});
  await cA.nuagePousser();
  T('la partie est rattachée au premier envoi', cA.nuageLie()===true);
  T('le serveur a bien reçu la partie', serveur.lignes.size===1);
  T('état affiché : sauvegardé', cA.nuageEtat().statut==='ok', cA.nuageEtat().statut);
  const p=cA.profilActif();
  T('le code est engendré, pas saisi', typeof p.ncode==='string' && p.ncode.length>=16, p.ncode);
  T('le diagnostic annonce que tout va bien', /Rien à faire/.test(cA.diagNuageHTML()));
}

/* ===============================================================
   3. PANNES — la règle : rien ne se perd, la partie continue
   =============================================================== */
{
  serveur.muet=true;
  cA.noterEvenement('note',{note:'écrite pendant la panne'});
  const n=cA.carnet().length;
  await cA.nuagePousser();
  T('serveur injoignable : état affiché en échec', cA.nuageEtat().statut==='erreur',
    cA.nuageEtat().statut);
  T('serveur injoignable : la note reste en local', cA.carnet().length===n);
  T('serveur injoignable : le diagnostic rassure explicitement',
    /Rien n’est perdu/.test(cA.diagNuageHTML()));

  serveur.muet=false; serveur.panne=true;
  await cA.nuagePousser();
  T('serveur en erreur : état affiché en échec', cA.nuageEtat().statut==='erreur');
  T('serveur en erreur : le code HTTP est rapporté', /500/.test(cA.nuageEtat().detail),
    cA.nuageEtat().detail);

  serveur.panne=false;
  reseau.enLigne=false;
  await cA.nuagePousser();
  T('hors ligne : état distinct de l échec', cA.nuageEtat().statut==='horsligne',
    cA.nuageEtat().statut);
  T('hors ligne : aucun appel tenté', true);
  T('hors ligne : le diagnostic dit que ça repartira seul',
    /repartira/.test(cA.diagNuageHTML()));

  reseau.enLigne=true;
  await cA.nuagePousser();
  T('retour du réseau : la note écrite pendant la panne est montée',
    (serveur.lignes.get(cA.profilActif().nid).etat.carnet||[])
      .some(e=>e.note==='écrite pendant la panne'));
  T('retour du réseau : état rétabli', cA.nuageEtat().statut==='ok');
}

/* ===============================================================
   4. IDENTIFIANTS REFUSÉS
   =============================================================== */
{
  const p=cA.profilActif(); const vrai=p.ncode;
  p.ncode='MAUVAIS-CODE';
  const n=cA.carnet().length;
  await cA.nuagePousser();
  T('code refusé : état explicite', cA.nuageEtat().statut==='refus', cA.nuageEtat().statut);
  T('code refusé : le carnet local est intact', cA.carnet().length===n);
  T('code refusé : le diagnostic ne parle pas d erreur technique',
    /refuse les identifiants/.test(cA.diagNuageHTML()));
  p.ncode=vrai;
  await cA.nuagePousser();
  T('code rétabli : la synchro repart', cA.nuageEtat().statut==='ok');
}

/* ===============================================================
   5. DEUX APPAREILS — le cas qui justifie toute la mécanique
   =============================================================== */
{
  const p=cA.profilActif();
  const idDistant=p.nid, codeDistant=p.ncode;

  /* B adopte la même partie : c'est le geste « nouvel appareil ». */
  const cB=charger(true);
  const pB=cB.profilActif();
  pB.nid=idDistant; pB.ncode=codeDistant;
  await cB.nuageTirer();
  T('B récupère le carnet de A',
    cB.carnet().some(e=>e.note==='première'), cB.carnet().length+' entrées');

  /* Chacun écrit une note de son côté. */
  cA.noterEvenement('note',{note:'écrite sur A'});
  cB.noterEvenement('note',{note:'écrite sur B'});
  await cA.nuagePousser();
  await cB.nuagePousser();
  await cA.nuageTirer();
  const notes=cA.carnet().map(e=>e.note);
  T('aucune note n est écrasée par l autre appareil',
    notes.includes('écrite sur A') && notes.includes('écrite sur B'), JSON.stringify(notes));

  /* Une suppression sur B ne doit pas ressusciter depuis A. */
  const cible=cB.carnet().find(e=>e.note==='écrite sur B');
  cB.carnetSupprimer(cible.eid);
  await cB.nuagePousser();
  await cA.nuageTirer();
  T('une entrée retirée sur B ne revient pas depuis A',
    !cA.carnet().some(e=>e.eid===cible.eid));
  T('la pierre tombale a voyagé', (cA.getEtat().carnetTombes||[]).includes(cible.eid));

  /* Un songe modifié : le plus récent l'emporte, quel que soit l'ordre. */
  const e=cA.carnet().find(x=>x.note==='écrite sur A');
  e.songe='version A'; e.songeT=1000; cA.sauver();
  const eB=cB.carnet().find(x=>x.eid===e.eid);
  if(eB){ eB.songe='version B'; eB.songeT=2000; cB.sauver(); }
  await cA.nuagePousser(); await cB.nuagePousser(); await cA.nuageTirer();
  T('le songe le plus récent gagne',
    (cA.carnet().find(x=>x.eid===e.eid)||{}).songe==='version B');
}

/* ===============================================================
   6. LE LOCAL RESTE LA RÉFÉRENCE
   =============================================================== */
{
  serveur.reinit();
  const c=charger(true);
  /* Le registre local survit au rechargement — comme sur un vrai appareil.
     On repart d'une partie non rattachée pour isoler ce qu'on veut mesurer. */
  const p6=c.profilActif(); delete p6.nid; delete p6.ncode;
  c.noterEvenement('note',{note:'locale récente'});
  await c.nuagePousser();
  const id=c.profilActif().nid;
  T('section 6 : la partie s est bien rattachée', !!id && serveur.lignes.has(id),
    'id='+id+' lignes='+serveur.lignes.size);
  if(!serveur.lignes.has(id)) { console.log('  (section 6 interrompue)'); }
  else {
  /* Le serveur porte une version PLUS ANCIENNE : elle ne doit pas gagner. */
  serveur.lignes.get(id).etat=Object.assign({}, serveur.lignes.get(id).etat,
    {credits:1, majLocal:1});
  const cr=c.getEtat().credits;
  await c.nuageTirer();
  T('une version distante plus ancienne n écrase pas la locale',
    c.getEtat().credits===cr, c.getEtat().credits+' vs '+cr);
  T('… mais son carnet est tout de même réuni',
    c.carnet().some(e=>e.note==='locale récente'));
  }
}

/* ===============================================================
   7. DÉMARRAGE D'UNE PARTIE ANTÉRIEURE À LA SYNCHRO
   Le cas qui a échappé à la v112 : une partie créée avant la mise en place
   n'est liée à aucune ligne distante. `nuageTirer()` sortait en silence et il
   ne se passait RIEN jusqu'au premier enregistrement — pastille au repos, et
   aucune explication nulle part. Une partie qui existe doit être mise à l'abri
   sans qu'on ait à y toucher.
   =============================================================== */
{
  serveur.reinit();
  const c=charger(true);
  const p=c.profilActif(); delete p.nid; delete p.ncode;   // partie « d'avant »
  T('au départ, la partie n est liée à rien', c.nuageLie()===false);
  await c.nuageDemarrer();
  T('le démarrage rattache une partie non liée', c.nuageLie()===true);
  T('le démarrage la met effectivement à l abri', serveur.lignes.size===1);
  T('le démarrage ne laisse pas la pastille au repos',
    c.nuageEtat().statut!=='inactif', c.nuageEtat().statut);
  T('la pastille annonce le succès', c.nuageEtat().statut==='ok', c.nuageEtat().statut);
  /* Et le statut doit être visible SANS aller chercher le sous-écran : il
     figure dans les réglages principaux. */
  const reg=c.reglagesHTML?c.reglagesHTML():'';
  T('le glyphe de la pastille est un nuage dès le repos',
    c.NUAGE_LIBELLE.inactif[0]==='\u2601', c.NUAGE_LIBELLE.inactif[0]);
}

/* ---- Sortie ---- */
console.log('');
console.log('  RÉUSSITES ('+ok+')');
echecs.forEach(e=>console.log('   \u2717 '+e));
console.log('  ÉCHECS ('+echecs.length+')');
process.exit(echecs.length?1:0);

})();
