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
/* Deux versions distinctes, qu'on confondait sous un seul nom.

   VERSION_APP est la version du FORMAT DE SAUVEGARDE. Elle ne bouge que si la
   structure d'un export change, et sert à l'import. Elle n'a rien à dire sur la
   fraîcheur du code.

   VERSION_ATLAS est la version de l'APPLICATION. Elle doit être identique à
   celle du service worker, faute de quoi le code chargé et le cache qui le sert
   ne parlent pas de la même chose — qc.js le vérifie à chaque passage. */
const VERSION_APP='v2';
const VERSION_ATLAS='v108';

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
          /* Primes de niveau déjà versées, pour qu'une relecture ne les
             redonne pas. Porté par l'export au même titre que le reste. */
          niveauxFinis:{},
          /* Quelle série est dépliée dans la Bourse. Sans mémoire, chaque
             retour au menu refermerait celle qu'on vient d'ouvrir. */
          seriesOuvertes:{},
          stats:{}, ordre:{}, ordreN:0, tri:'chantier', accueilVu:false,
          /* Fouille payée dont le résultat n'est pas encore livré. Voir la
             section « Transaction de fouille ». `null` = aucune dette. */
          fouilleEnCours:null,
          /* Le carnet fait partie de l'état : il est donc porté tel quel par
             l'export de progression et rétabli par normaliser() à l'import. */
          carnet:[], carnetTri:'tout', carnetOrdre:'asc', carnetGroupe:false};
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

/* Registre des sujets d'introduction. Déclaré ici, en tête, parce qu'il est
   alimenté depuis basculerProfil() au démarrage : toute déclaration plus bas
   dans le fichier serait encore en zone morte à ce moment-là. */
const SUJETS_INTRO=new Map();

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
  resetSessionTransitoire();
  enregistrerNiveaux();
  majNomProfil(); majSolde(); majFondGlobal(); vueCarte(); montrer('fouille');
  if(besoinAccueil()) ouvrirAccueil();
  else if(reprendreFouille()) toast('Profil : '+(profilActif()||{}).nom+' \u00B7 tranchée rouverte');
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
    /* Supprimer le profil actif change de partie sans passer par
       basculerProfil : la session doit y être coupée aussi. */
    resetSessionTransitoire();
    majFondGlobal(); vueCarte(); montrer('fouille');
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

/* ---------- Sauvegarde complète ----------

   Ce qui est enregistré ici ne vit que dans le stockage local de CE navigateur,
   sur CET appareil. Trois conséquences qu'il vaut mieux avoir dites :

     - désinstaller l'application efface ce stockage. Ce n'est pas récupérable ;
     - l'application installée et le navigateur peuvent ne pas partager le même
       stockage — c'est systématiquement le cas sur iPhone, où une application
       ajoutée à l'écran d'accueil reçoit son propre espace ;
     - forcer la mise à jour, en revanche, ne touche à rien : elle ne vide que
       les caches de fichiers et désinscrit le service worker.

   Le seul recours durable est donc un fichier, hors du navigateur. L'export ne
   portait que la partie active : après une réinstallation, il aurait fallu
   autant de fichiers que de parties, et se souvenir de tous les faire. Il porte
   désormais l'ensemble. */
function paquetComplet(){
  return {app:'gronosaures', schema:SCHEMA, version:VERSION_APP, complet:true,
    exporte:new Date().toISOString(),
    profils:registre.liste.map(p=>{
      const e=normaliser(litJSON(cleEtat(p.id))||etatVide());
      return {nom:p.nom, cree:p.cree||null,
        resume:{creatures:Object.keys(e.collection||{}).filter(k=>e.collection[k]>0).length,
                credits:e.credits},
        etat:e};
    })};
}

function telecharger(nom, contenu){
  const b=new Blob([contenu],{type:'application/json'});
  const u=URL.createObjectURL(b);
  const a=document.createElement('a');
  a.href=u; a.download=nom; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(u); a.remove();},0);
}

function sauvegarderTout(){
  try{
    const n=registre.liste.length;
    telecharger('gronosaures-sauvegarde-'+new Date().toISOString().slice(0,10)+'.json',
      JSON.stringify(paquetComplet(),null,2));
    registre.dernierExport=Date.now();
    ecritJSON(PROFILS_CLE, registre);
    if($('#rg-sauv')) majBlocSauvegarde();
    toast(n>1 ? n+' parties sauvegardées' : 'Partie sauvegardée');
  }catch(e){ toast('Sauvegarde impossible'); }
}

/* « il y a trois jours » se lit plus vite qu'une date, quand la question est
   seulement de savoir si c'est vieux. */
function depuis(ts){
  if(!ts) return null;
  const j=Math.floor((Date.now()-ts)/86400000);
  if(j<=0) return "aujourd'hui";
  if(j===1) return 'hier';
  if(j<30) return 'il y a '+j+' jours';
  const m=Math.floor(j/30);
  return 'il y a '+m+' mois';
}

function majBlocSauvegarde(){
  const l=$('#rg-sauv-date'); if(!l) return;
  const q=depuis(registre.dernierExport);
  l.textContent=q||'jamais';
  l.className = !q ? 'alerte' : (Date.now()-registre.dernierExport>30*86400000 ? 'alerte' : 'ok');
  const c=$('#rg-contexte');
  if(c){
    const seul = (window.matchMedia && matchMedia('(display-mode: standalone)').matches)
      || navigator.standalone===true;
    c.textContent = seul ? 'application installée' : 'navigateur';
  }
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
    if(!d || d.app!=='gronosaures') return toast('Ce n’est pas un export de l’atlas');
    if(d.schema>SCHEMA) return toast('Fichier trop récent pour cette version');

    /* Deux formats acceptés : la sauvegarde complète, et l'export d'une seule
       partie produit par les versions antérieures. Un fichier ancien doit
       continuer de fonctionner — c'est précisément celui qu'on retrouve quand
       on en a besoin. */
    const lots = Array.isArray(d.profils) ? d.profils
               : (d.etat ? [{nom:(d.profil&&d.profil.nom)||'Import', etat:d.etat}] : null);
    if(!lots || !lots.length) return toast('Fichier sans progression');

    /* On ajoute, on n'écrase jamais : une restauration ne doit pas pouvoir
       détruire ce qui est déjà là si le fichier n'est pas le bon. */
    let dernier=null;
    lots.forEach(l=>{
      const id=idNeuf();
      registre.liste.push({id, nom:String(l.nom||'Import').slice(0,24),
                           cree:l.cree||Date.now(), vue:Date.now()});
      ecritJSON(cleEtat(id), normaliser(l.etat));
      dernier=id;
    });
    ecritJSON(PROFILS_CLE, registre);
    toast(lots.length>1 ? lots.length+' parties restaurées' : 'Partie restaurée');
    if(dernier) basculerProfil(dernier);
  };
  fr.readAsText(fichier);
}

/* Tracés d'interface. Un caractère de flèche ou de croix est dessiné par la
   police du système : sur iOS le rendu était mauvais et peu lisible. Ces deux
   tracés sont identiques partout et se colorent par `currentColor`. */
const FLECHE_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19"/></svg>';
const CROIX_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>';

const creaturesDe=site=>CREATURES.filter(c=>c.site===site);
/* Le bonus d'achèvement suit le coût du site : ouvrir Ouadi al-Hitan coûte
   près de dix fois Burgess, le rendre ne peut pas rapporter autant. Le plancher
   garde les premiers sites généreux. */
const bonusDe=id=>{const s=SITES.find(x=>x.id===id);
  return s?Math.max(BONUS_SITE,Math.round(s.cout*BONUS_PART)):BONUS_SITE;};
const possede=id=>(etat.collection[id]||0)>0;
const fragments=id=>etat.collection[id]||0;
const ouvert=id=>!!etat.sitesOuverts[id];
/* Montée par paliers rétablie, mais resserrée : une copie par niveau. Le
   dossier s'ouvre à la première trouvaille et se complète à la troisième.
   Passer ce drapeau à false rend le dossier plein d'emblée. */
const NIVEAUX_PROGRESSIFS=true;

function niveauDoc(id){
  const f=fragments(id); if(f<=0)return 0;
  if(!NIVEAUX_PROGRESSIFS) return SEUILS_DOC.length;
  let n=1; for(let i=1;i<SEUILS_DOC.length;i++) if(f-1>=SEUILS_DOC[i]) n=i+1;
  return n;
}
const siteComplet=s=>creaturesDe(s).every(c=>possede(c.id));

/* Deux achèvements distincts, et il faut les distinguer : avoir rencontré les
   six créatures d'un chantier, et avoir complété les six dossiers. Le premier
   marque la fin de la découverte, le second celle de la lecture — c'est ce
   dernier qui compte vraiment ici. */
const siteDore=s=>creaturesDe(s).every(c=>niveauDoc(c.id)>=SEUILS_DOC.length);

/* Marque d'achèvement, partagée par la carte, la frise et la collection. */
function sceau(id){
  if(siteDore(id))   return '<span class="sceau or" title="Tous les dossiers complets">\u2726</span>';
  if(siteComplet(id))return '<span class="sceau" title="Toutes les créatures rencontrées">\u2713</span>';
  return '';
}
const nbTrouvees=s=>creaturesDe(s).filter(c=>possede(c.id)).length;
const trouvees=()=>CREATURES.filter(c=>possede(c.id));

/* Légende d'une vignette, sur deux lignes.

   Les noms vont de « Marrella » à « Equus ferus caballus — cheval de trait
   belge ». Une seule ligne tronquée les rend illisibles et interchangeables ;
   deux lignes bien réparties les rendent reconnaissables d'un coup d'œil.

   Découpe, par ordre de priorité :
     — un tiret cadratin sépare le taxon de son nom courant ;
     — sinon le premier mot est le genre, le reste l'épithète ;
     — un mot seul occupe la ligne du haut.
   La ligne basse peut réunir plusieurs mots (« sp. cf. P. daihoense »), qu'on
   ne coupe jamais : on réduit le corps du texte à la place. */
function legende(nom){
  const n=String(nom||'').trim();
  const tiret=n.indexOf('\u2014');
  if(tiret>0) return {haut:n.slice(0,tiret).trim(), bas:n.slice(tiret+1).trim()};
  const i=n.indexOf(' ');
  if(i<0) return {haut:n, bas:''};
  return {haut:n.slice(0,i), bas:n.slice(i+1)};
}

/* Le corps du texte suit la longueur — mais c'est le mot le plus LONG qui
   contraint, pas la ligne entière : les groupes de mots passent à la ligne,
   un mot ne se coupe pas.

   Mesures sur les 193 créatures : mot médian de 9 caractères, 90 % sous 13,
   et un seul cas extrême, Schlotheimophyllum, à 18. La carte de collection
   offre environ 88 px utiles ; à 0,7 rem elle loge 16 caractères, à 0,6 rem
   elle en loge 19. Deux paliers suffisent donc, et l'immense majorité des
   noms reste au corps confortable. */
function classeLegende(l){
  const mots=(l.haut+' '+l.bas).split(/\s+/).filter(Boolean);
  const max=Math.max(0, ...mots.map(m=>m.length));
  return max>15 ? ' lg-xs' : max>12 ? ' lg-s' : '';
}

function legendeHTML(nom){
  const l=legende(nom);
  return `<span class="lg${classeLegende(l)}">
    <b>${esc(l.haut)}</b>${l.bas?`<i>${esc(l.bas)}</i>`:''}</span>`;
}

/* Révélation du CONTENU d'une fiche. À distinguer de possede(), qui reste la
   possession réelle et continue d'alimenter les compteurs et la progression.
   Avec FICHES_LIBRES, on lit tout de suite ; sans lui, on lit ce qu'on a
   trouvé — la mécanique d'origine, conservée telle quelle. */
const revele=id=>FICHES_LIBRES||possede(id);

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
  return t.length ? pioche(t).img : fondDe(pioche(SITES));
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
  /* Revenir à l'onglet Fouille doit rendre l'écran qu'on avait quitté — repartir
     de la carte oblige à refaire tout le chemin. Mais il faut le RECONSTRUIRE et
     pas seulement le réafficher : sinon il montre l'état d'avant.

     C'est ainsi qu'une créature déterrée puis consultée dans la collection
     restait verrouillée sur son chantier. Le bouton « Consulter la fiche »
     quittait la fouille sans la régénérer, et le retour se contentait de
     redonner un écran périmé. */
  if(ecran==='fouille'){
    if(siteActif) chantier(siteActif);
    else vueCarte();
    requestAnimationFrame(()=>{ if(pzMonde && $('#vue-carte').style.display!=='none') pzMonde.refit(); });
  }
  if(ecran==='collection'){ majFondGlobal(); rendreCollection(); }
  if(ecran==='carnet'){ majFondGlobal(); rendreCarnet(); }
  /* Bourse : une mission en cours n'est pas perdue parce qu'on est allé écrire
     au carnet. On reprend la question là où on l'avait laissée — prendre note
     au milieu d'une série était puni par la perte des réponses précédentes,
     c'est-à-dire exactement le geste qu'on cherche à encourager. */
  if(ecran==='bourse'){
    majFondGlobal();
    if(mission && packActif) reprendreExo(); else menuPacks();
  }
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
  const ouv=ouvert(s.id), fini=ouv&&n>=tot, dore=ouv&&siteDore(s.id);
  const sous = ouv ? (dore?'\u2726 '+n+'/'+tot : n+'/'+tot) : s.cout+' \u25C8';
  return `<g class="zsc pin${fini?' fini':''}${dore?' dore':''}${ouv?'':' verrouille'}" data-x="${s.x}" data-y="${s.y}"
            data-site="${s.id}" tabindex="0" role="button" aria-label="${esc(s.nom)}">
    <circle class="pin-halo" r="26"/>
    <circle class="pin-core" r="13"/>
    ${ouv?'<circle class="pin-shine" cx="-4" cy="-4" r="3.5"/>'
         :'<path class="pin-cadenas" d="M-4,-1 h8 v6 h-8 z M-2.4,-1 v-2.6 a2.4,2.4 0 0 1 4.8,0 v2.6"/>'}
    ${fini?'<path class="pin-sceau" d="M-6,0 L-2,4.5 L6.5,-4.5"/>':''}
    ${plaqueTexte(s.court, sous, 28)}</g>`;
}
function marqueurGrappe(g){
  const b=boiteDe(g), cx=Math.round(b.x+b.w/2), cy=Math.round(b.y+b.h/2);
  const ouverts=g.filter(s=>ouvert(s.id)).length;
  const l1=g.length+' chantiers';
  const l2=ouverts?ouverts+' ouvert'+(ouverts>1?'s':''):'zoomer pour ouvrir';
  return `<g class="zsc grappe" data-x="${cx}" data-y="${cy}"
            data-sites="${g.map(s=>s.id).join(',')}" tabindex="0" role="button"
            aria-label="${g.length} chantiers : ${esc(g.map(s=>s.court).join(', '))}">
    <circle class="pin-halo" r="30"/>
    <circle class="grappe-core" r="17"/>
    <text class="grappe-nb" y="6">${g.length}</text>
    ${plaqueTexte(l1, l2, 32)}</g>`;
}

/* Étiquette sur plaque opaque.

   Les étiquettes reposaient sur un contour noir épais posé derrière le texte
   (`paint-order:stroke`). Sur Android le rendu passe ; sur Safari il empâte les
   lettres au point de les rendre illisibles, et d'autant plus que la ligne est
   longue — c'est pourquoi les noms de site courts restaient lisibles quand
   « zoomer pour ouvrir » ne l'était plus.

   Plutôt que de parier sur le rendu d'un contour, on pose une plaque opaque
   derrière les deux lignes. La largeur est estimée à partir du nombre de
   caractères : SVG ne mesure pas le texte avant de l'avoir rendu, et une
   estimation large vaut mieux qu'une mesure qui coûterait un reflow par
   épingle à chaque déplacement de la carte. */
const LARG_CAR_LBL=0.55, LARG_CAR_SUB=0.52;
function plaqueTexte(l1, l2, yHaut){
  const w1=l1.length*15*LARG_CAR_LBL, w2=l2.length*12*LARG_CAR_SUB;
  const w=Math.ceil(Math.max(w1,w2))+20;
  return `<rect class="pin-plaque" x="${-w/2}" y="${yHaut}" width="${w}" height="34" rx="9"/>
    <text class="pin-lbl" y="${yHaut+15}">${esc(l1)}</text>
    <text class="pin-sub" y="${yHaut+28}">${esc(l2)}</text>`;
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
      <p class="md-corps">Le coût est unique : le site reste ensuite accessible.</p>
      <div class="md-cout${assez?'':' court'}">${s.cout} \u25C8
        <span>${assez?'disponible : '+etat.credits+' \u25C8':'il te manque '+(s.cout-etat.credits)+' \u25C8'}</span></div>
      <button class="btn-primaire" ${assez?`onclick="debloquer('${s.id}')"`:'disabled'}>Ouvrir le chantier</button>
      <button class="btn-fant" onclick="fermerModal()">Plus tard</button>
      ${assez?'':'<p class="md-aide">Les missions rapportent des crédits.</p>'}
    </div>`;
  setFondImg($('#md-vue'), fondDe(s), 'linear-gradient(180deg,rgba(10,15,26,.2),rgba(17,24,38,.96))');
  /* La même vue sert de fond à l'introduction, juste après. La demander ici la
     met en cache pendant que la personne lit la fenêtre : au moment d'appuyer,
     elle est déjà là, et le bouton ne paraît plus inerte. */
  new Image().src=fondDe(s);
  $('#modal').classList.add('on');
}
function fermerModal(){ $('#modal').classList.remove('on'); }
function debloquer(id){
  const s=SITES.find(x=>x.id===id);
  if(ouvert(id)) return chantier(id);
  if(etat.credits<s.cout) return toast('Crédits insuffisants');
  etat.credits-=s.cout; etat.sitesOuverts[id]=true; noterChantier(s); sauver(); majSolde(true);
  fermerModal(); construireCarte(true); introSite(id);
}

/* 4c. Introduction théorique : la vue satellite du site sert de fond. */
let introI=0, introSiteId=null, introRelecture=false;

/* L'introduction a d'abord été écrite pour les chantiers, et n'allait donc
   chercher que dans SITES. Les packs de la Bourse en ont maintenant besoin :
   dans les séries scientifiques, le récit EST le contenu et les questions ne
   font que le fixer. Plutôt que d'écrire un second écran, on généralise la
   source — un niveau de pack se présente comme un chantier, avec ses volets et
   ses pastilles, et se termine par une mission au lieu d'une fouille. */
function sujetIntro(id){
  /* Filet : si le registre est vide, on le remplit ici. La première version
     l'alimentait depuis basculerProfil(), appelé au démarrage AVANT que le
     const soit initialisé — zone morte temporelle, exception silencieuse,
     registre vide, et un clic sur un niveau ne faisait rien du tout. */
  if(!SUJETS_INTRO.size) enregistrerNiveaux();
  return SUJETS_INTRO.get(id) || SITES.find(x=>x.id===id) || null;
}
/* Un niveau de pack devient un sujet d'introduction. Appelé au démarrage pour
   chaque niveau déclaré, il n'y a donc rien à tenir à jour à la main. */
function enregistrerNiveaux(){
  (typeof PACKS==='undefined'?[]:PACKS).forEach(p=>{
    (p.niveaux||[]).forEach((n,i)=>{
      SUJETS_INTRO.set('niv:'+p.id+':'+i, {
        id:'niv:'+p.id+':'+i, pack:p.id, niveau:i,
        nom:n.titre, court:n.titre, accroche:n.accroche||'',
        intro:n.intro||[],
        /* Sans cette ligne, les 81 sources de la série conscience existaient
           dans les données et n'arrivaient jamais à l'écran. */
        liens:n.liens||[],
        /* Illustrations par volet : le SVG de Mendeleïev a existé deux versions
           sur disque sans jamais être montré — la conception le prévoyait,
           l'écran l'ignorait. */
        imgVolets:n.imgVolets||null
      });
    });
  });
}
function introSite(id,relecture){
  introSiteId=id; introI=0; introRelecture=!!relecture;
  const s=sujetIntro(id);
  if(!s) return;
  const estNiveau=!!s.pack;
  /* Le voile ne doit assombrir que ce qui porte du texte. Il partait de 30 % pour
     finir à 98 % : la vue satellite disparaissait dans sa moitié basse. */
  setFondImg($('#intro-fond'), estNiveau ? imageDeFond() : fondDe(s),
    'linear-gradient(180deg,rgba(6,10,18,.12) 0%,rgba(6,10,18,.34) 40%,rgba(6,10,18,.86) 100%)');
  /* Chaque vue satellite porte, en bas à droite, un petit globe qui situe le
     continent sur la Terre d'aujourd'hui. Cadré en `cover` sur un écran de
     téléphone, ce coin était rogné ; recouvert par le bloc de texte, il
     disparaissait. Il est donc extrait en pastille (tools/globes.py) et posé
     au-dessus de tout, en haut à droite, là où rien ne le masque. */
  const g=$('#intro-globe-img');
  if(g){
    /* Pastille facultative : les nouveaux packs n'ont pas de vue satellite,
       donc pas de globe extrait. On masque plutôt que d'afficher un lien mort. */
    const dispo=!estNiveau && GLOBES_DISPONIBLES.includes(s.id);
    g.style.display = dispo ? '' : 'none';
    if(dispo){ g.src='globes/'+s.id+'.webp'; g.alt='Position de '+s.court+' sur le globe actuel'; }
  }
  $('#intro-accroche').textContent=s.accroche;
  $('#intro-titre').textContent=s.nom;
  afficheIntro();
  $('#intro').classList.add('on');
}
function afficheIntro(){
  const s=sujetIntro(introSiteId);
  if(!s) return;
  $('#intro-txt').textContent=s.intro[introI];
  const im=$('#intro-img');
  if(im){
    const src=s.imgVolets && s.imgVolets[introI];
    if(src){ im.src=src; im.style.display=''; } else { im.removeAttribute('src'); im.style.display='none'; }
  }
  /* Les pastilles deviennent atteignables : elles indiquaient la position sans
     permettre d'y aller, ce qui est une promesse non tenue. */
  $('#intro-dots').innerHTML=s.intro.map((_,i)=>
    `<span class="${i===introI?'on':''}" role="button" tabindex="0"
       aria-label="Volet ${i+1}" onclick="introAller(${i})"></span>`).join('');
  $('#intro-next').textContent = introI<s.intro.length-1 ? 'Continuer ›'
    : (s.pack ? 'Passer aux questions →' : 'Descendre sur le chantier →');
  /* Le bouton précédent était masqué par visibility au premier volet, donc
     invisible et sans explication. Il reste maintenant en place, désactivé :
     on voit qu'il existe et pourquoi il ne répond pas. */
  const pr=$('#intro-prec');
  if(pr){ pr.disabled = introI===0; pr.classList.toggle('inerte', introI===0); }
  const rg=$('#intro-rang');
  if(rg) rg.textContent = (introI+1)+' / '+s.intro.length;

  /* Liens sourcés du niveau : ils n'étaient chargés nulle part alors que la
     série sur la conscience en porte quatre-vingt-un. */
  const li=$('#intro-liens');
  if(li){
    /* Un lien accompagne le passage qui l'appelle, pas la fin du livre. Les
       sources par carte (conscience) portent l'index de leur volet ; celles
       de niveau (séries à équations, sections Sources des docs) s'affichent
       sur le dernier volet, là où l'on referme le récit. Les mettre toutes
       partout revenait à un tas — c'est ce que le playtest a vu. */
    const tous=s.liens||[];
    const dernier=introI===s.intro.length-1;
    const L=tous.filter(x=> x.v!==undefined ? x.v===introI : dernier).slice(0,7);
    li.innerHTML = L.length
      ? '<h4>'+(dernier && !tous.some(x=>x.v!==undefined)?'Sources du niveau':'Sources')+'</h4>'
        +L.map(x=>`<a href="${x.u}" target="_blank" rel="noopener">${esc(x.t)}</a>`).join('')
      : '';
  }
  const sg=$('#intro-songe'); if(sg) sg.innerHTML='';
  const nx=$('#intro-noter'); if(nx) nx.style.display='';
}

function introAller(i){
  const s=sujetIntro(introSiteId);
  if(!s || i<0 || i>=s.intro.length || i===introI) return;
  introI=i; afficheIntro();
}
function introPrecedent(){ if(introI>0){ introI--; afficheIntro(); } }

/* Balayage horizontal sur l'introduction.

   Un enchaînement de volets sans possibilité de revenir oblige à tout relire
   depuis le début pour retrouver une phrase. Le bouton « Précédent » couvre le
   cas, le balayage le rend naturel.

   Le seuil de 45 px et la contrainte d'horizontalité évitent de déclencher sur
   un défilement vertical du texte, qui reste prioritaire. */
function armerBalayageIntro(){
  const el=$('#intro'); if(!el) return;
  let x0=0, y0=0, actif=false;
  el.addEventListener('touchstart',e=>{
    /* Un balayage qui démarre dans la zone de note ou sur un lien n'est pas
       une navigation : on écrit, ou on vise. */
    if(e.target.closest('a,button,textarea,input,.intro-liens,.intro-songe')){ actif=false; return; }
    if(e.touches.length!==1){ actif=false; return; }
    x0=e.touches[0].clientX; y0=e.touches[0].clientY; actif=true;
  },{passive:true});
  el.addEventListener('touchend',e=>{
    if(!actif) return; actif=false;
    const t=e.changedTouches[0];
    const dx=t.clientX-x0, dy=t.clientY-y0;
    if(Math.abs(dx)<45 || Math.abs(dx)<Math.abs(dy)*1.4) return;
    if(dx<0) introSuivant(); else introPrecedent();
  },{passive:true});
}
function introSuivant(){
  const s=sujetIntro(introSiteId);
  if(!s) return;
  introI++;
  if(introI>=s.intro.length){
    $('#intro').classList.remove('on');
    if(!introRelecture){
      etat.introVue[introSiteId]=true;
      /* L'introduction est le morceau le plus narratif de l'application : on
         laisse une trace au carnet, où une note pourra s'y accrocher. */
      noterEvenement('pack', {id:'intro-'+introSiteId, site:s.pack||introSiteId,
        sujet:'Introduction — '+s.nom, note:s.accroche||''});
      sauver();
    }
    const id=introSiteId; introSiteId=null;
    /* Un chantier mène à la tranchée, un niveau de pack à sa mission. */
    if(s.pack) lancerNiveau(s.pack, s.niveau); else chantier(id);
    return;
  }
  afficheIntro();
}

/* 4d. Chantier : plein écran, fond tournant sur les créatures déjà sorties
   de la roche, un seul bouton. */
let fondTimer=null, fondI=0;
function fondsDuSite(s){
  const t=creaturesDe(s).filter(c=>possede(c.id)).map(c=>c.img);
  return t.length ? t : [fondDe(s)];
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
  /* Le nombre de colonnes est désormais posé par la feuille de style, qui seule
     connaît la largeur disponible : deux colonnes sur téléphone, davantage à
     mesure que l'écran s'élargit. On efface donc toute valeur en ligne héritée. */
  $('#ch-vignettes').style.gridTemplateColumns='';
  $('#ch-vignettes').dataset.n=cs.length;
  /* Une case vide ne dit pas si elle est vide parce qu'il n'y a rien à trouver
     ou parce qu'on n'a pas encore trouvé. On l'écrit, comme dans la collection. */
  $('#ch-vignettes').innerHTML=cs.map(c=>{
    const ok=revele(c.id), eu=possede(c.id);
    /* Trois états, et ils doivent se distinguer d'un coup d'œil :
       trouvée (nette, liserée), lisible mais pas trouvée (grisée, marquée
       d'un point creux), inconnue (point d'interrogation). */
    /* On montre la créature, on n'ouvre pas son dossier : la fiche complète
       reste la récompense de la trouvaille. */
    return `<button class="vig${ok?'':' verrou'}${eu?' eu':' pas-eu'}" ${eu?`onclick="ouvrirFiche('${c.id}')"`:''}
      title="${ok?esc(c.nom)+(eu?'':' — pas encore trouvée'):'Créature non découverte'}">
      ${ok?`<img src="${c.img}" loading="lazy" alt="${esc(c.nom)}">
            <span class="vig-etat">${eu?'\u25CF':'\u25CB'}</span>
            ${legendeHTML(c.nom)}`
          :'<span class="vig-q">?</span>'}</button>`;
  }).join('');
  $('#ch-cout').textContent=COUT_FOUILLE;
  majSolde();
}

/* 4e. Coup de pioche. Le crédit est débité à l'ouverture de la tranchée,
   puis une question du site décide si elle livre quelque chose.
   Deux essais, un indice : l'aide ne prive pas du tirage. */
const NB_ESSAIS=2;
let qFouille=null;
/* ---- Transaction de fouille ---------------------------------------------
   Une fouille se paie à l'OUVERTURE de la tranchée et ne rend son résultat
   qu'après la question. Entre les deux, rien n'était écrit sur disque : fermer
   l'onglet, recharger, ou laisser le téléphone mettre l'application en veille
   faisait perdre les crédits sans rien livrer. Sur mobile la mise en veille
   n'est pas un cas limite, c'est le cas courant — et c'est le seul endroit du
   jeu où la joueuse peut perdre quelque chose.

   La fouille est donc un objet persistant, écrit dans le MÊME `sauver()` que le
   débit et effacé dans le MÊME `sauver()` que la récompense. À tout instant, la
   sauvegarde décrit soit une fouille payée et due, soit rien : jamais un débit
   sans contrepartie. Au démarrage, `reprendreFouille()` reprend la tranchée là
   où elle en était, ou rembourse si la question n'existe plus.

   Le même verrou rend la récompense IDEMPOTENTE : `tirage()` ne consomme la
   transaction qu'une fois, ce qui ferme au passage un double-tap sur « Extraire
   la pièce » qui livrait deux créatures pour une seule fouille. */
function consommerFouille(){
  const f=etat.fouilleEnCours; if(!f) return null;
  etat.fouilleEnCours=null; return f;
}
function majTransaction(champs){
  if(!etat.fouilleEnCours) return;
  Object.assign(etat.fouilleEnCours, champs);
  sauver();
}
/* Reprise au démarrage et à chaque changement de profil. Trois issues, dans
   cet ordre : aucune dette → rien à faire ; dette honorable → la tranchée
   rouvre exactement où elle en était ; dette inhonorable (question disparue
   d'un corpus qui a changé de version) → remboursement, jamais de perte
   silencieuse. */
function reprendreFouille(){
  const f=etat.fouilleEnCours; if(!f) return false;
  const q=QUIZ_PALEO.find(x=>x.id===f.qid);
  const site=SITES.find(x=>x.id===f.site);
  if(!q || !site){
    etat.credits+=f.cout||0;
    etat.fouilleEnCours=null;
    sauver(); majSolde(true);
    toast('Fouille interrompue \u00B7 '+(f.cout||0)+' \u25C8 remboursés');
    return false;
  }
  siteActif=f.site;
  qFouille={q, essais:f.essais||0, aide:!!f.aide,
            choix:(Array.isArray(f.choix)&&f.choix.length)?f.choix:melange(q.choix),
            marques:f.marques||{}, ecartes:f.ecartes||[],
            resolue:f.statut!=='question',
            juste:f.statut==='recompense'};
  chantier(f.site);
  montrer('fouille');
  rendreQuestionFouille();
  $('#tranchee').classList.add('on');
  return true;
}
function fouiller(){
  if(!siteActif) return;
  if(etat.fouilleEnCours) return toast('Une tranchée est déjà ouverte');
  if(etat.credits<COUT_FOUILLE) return toast('Crédits de recherche insuffisants');
  etat.credits-=COUT_FOUILLE; etat.fouilles=(etat.fouilles||0)+1;
  /* Débit et dette dans la même écriture : il n'existe aucun instant où l'un
     est enregistré sans l'autre. */
  etat.fouilleEnCours={site:siteActif, cout:COUT_FOUILLE, qid:null,
                       essais:0, aide:false, choix:null, statut:'question'};
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
  /* L'ordre des propositions est mémorisé, pas seulement l'identifiant : une
     reprise qui remélangerait donnerait un écran différent de celui qu'on avait
     sous les yeux, et le bouton déjà écarté par l'indice changerait de place. */
  majTransaction({qid:q.id, choix:qFouille.choix, essais:0, aide:false, statut:'question'});
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
    <p class="tr-intro">Identifie correctement et la tranchée livrera.</p>
    <div class="q-txt">${esc(q.q)}</div>
    <!-- Les questions portent sur les créatures du chantier, mais celles-ci
         n'étaient visibles nulle part pendant qu'on répondait : on devinait.
         La bande les rappelle, avec leur nom, à portée de regard. -->
    <div class="tr-bande">${creaturesDe(siteActif).map(c=>
      `<button class="tr-b" onclick="ouvrirFiche('${c.id}')" title="${esc(c.nom)}">
         <img src="${c.img}" loading="lazy" alt="">
         <em>${esc(legende(c.nom).haut)}</em></button>`).join('')}</div>
    <div id="tr-rep" class="q-choix">
      ${qFouille.choix.map(c=>{
        /* Marques, écarts d'indice et verrou sortent de `qFouille`, jamais du
           DOM : c'est ce qui permet à une tranchée reprise après un
           rechargement de réapparaître exactement telle qu'on l'avait laissée. */
        const mq=(qFouille.marques||{})[c] || (qFouille.resolue && egal(c,q.r) ? 'bon' : '');
        const ec=(qFouille.ecartes||[]).includes(c);
        const off=qFouille.resolue || ec || mq==='faux';
        return `<button class="rep${mq?' '+mq:''}${ec?' ecarte':''}"${off?' disabled':''}
          onclick="repFouille(this.textContent,this)">${esc(c)}</button>`;
      }).join('')}
    </div>
    <button class="btn-indice" id="tr-indice" onclick="indiceFouille()">Réduire le champ des possibles</button>
    <div class="q-fb" id="tr-fb"></div>`;
  rendreFbFouille();
}
/* Bas de la tranchée — indice, essai raté, correction. Même raison qu'à la
   Bourse : il doit pouvoir être REJOUÉ, ici parce qu'une fouille payée peut
   être reprise après un rechargement. */
function fbFouilleHTML(q, bon){
  return (bon ? `<b>Juste.</b> ${esc(q.exp)}`
              : `<b>Réponse : ${esc(q.r)}.</b> ${esc(q.exp)}`)
    +(q.src?`<div class="q-src"><a href="${esc(q.src[1])}" target="_blank" rel="noopener" onclick="lienSuivi('${q.id}')">${esc(q.src[0])}</a></div>`:'')
    +`<div id="doute-hote"></div><button class="lien-doute" onclick="ouvrirDoute('${q.id}','${esc(q.q).replace(/'/g,"\\'")}')">Ça me paraît faux</button>`
    +(bon ? `<button class="btn-primaire" onclick="tirage()">Extraire la pièce</button>`
          : `<button class="btn-primaire" onclick="trancheeSterile()">Refermer la tranchée</button>`);
}
function rendreFbFouille(){
  if(!qFouille) return;
  const q=qFouille.q, fb=$('#tr-fb'); if(!fb) return;
  const cacherIndice=()=>{ const b=$('#tr-indice'); if(b) b.style.display='none'; };
  if(qFouille.resolue){
    cacherIndice();
    $$('#tr-rep .rep, #tr-rep button').forEach(b=>{ b.disabled=true;
      if(b.classList.contains('rep') && egal(b.textContent,q.r)) b.classList.add('bon'); });
    fb.className='q-fb '+(qFouille.juste?'bon':'faux');
    fb.innerHTML=fbFouilleHTML(q, !!qFouille.juste);
    return;
  }
  const t=$('#tr-essais'); if(t) t.textContent='essai '+(qFouille.essais+1)+' / '+NB_ESSAIS;
  if(qFouille.aide){
    cacherIndice();
    const a=amorce(q.exp, q.r);
    fb.className='q-fb indice';
    fb.innerHTML=a ? `<b>Piste.</b> ${esc(a)}` : 'Deux propositions ont été écartées.';
    return;
  }
  if(qFouille.essais>0){
    fb.className='q-fb retry';
    fb.textContent='Pas celle-là. Il te reste un essai.';
  }
}
/* Sur un QCM factuel, écarter une mauvaise réponse aide plus qu'une phrase vague. */
/* L'indice écartait une proposition au hasard, ce qui n'apprend rien : on
   devinait un peu mieux sans comprendre davantage. Il donne maintenant le
   début de l'explication — du contenu vérifié, tiré de la même source que la
   réponse — et écarte deux propositions plutôt qu'une. On paie l'aide en
   renonçant à une part du gain, pas en s'interdisant de comprendre. */
function amorce(exp, reponse){
  let t=String(exp||'').trim();
  if(!t) return '';
  /* Les explications commencent souvent par la réponse — « En 1938, quand un
     spécimen… » pour la question qui demande la date. Livrer l'amorce telle
     quelle donnerait la solution : on caviarde d'abord la réponse et ses mots
     porteurs, puis on coupe. */
  const r=String(reponse||'').trim();
  if(r){
    const mots=r.split(/[\s,;:'\u2019()]+/).filter(m=>m.length>3);
    [r, ...mots].forEach(m=>{
      const e=m.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      t=t.replace(new RegExp(e,'gi'), '\u2588\u2588');
    });
    t=t.replace(/(\u2588\u2588[\s,]*)+/g,'\u2588\u2588 ');
  }
  const coupe=Math.max(30, Math.floor(t.length*0.5));
  let i=t.indexOf(' ', coupe);
  if(i<0 || i>t.length-6) i=t.length;
  const out=t.slice(0,i).replace(/[ ,;:]+$/,'');
  /* Si tout ce qui reste est du caviardage, l'indice n'apprend rien : on
     préfère ne rien dire plutôt que d'afficher une ligne vide de sens. */
  return /[a-zà-ÿ]{4}/i.test(out.replace(/\u2588/g,'')) ? out+'\u2026' : '';
}

function indiceFouille(){
  if(!qFouille || qFouille.resolue) return;
  qFouille.aide=true;
  qFouille.ecartes=qFouille.ecartes||[];
  const faux=$$('#tr-rep .rep').filter(b=>!egal(b.textContent,qFouille.q.r)&&!b.disabled);
  for(let k=0; k<2 && faux.length>1; k++){
    const v=faux.splice(rnd(0,faux.length-1),1)[0];
    v.disabled=true; v.classList.add('ecarte');
    qFouille.ecartes.push(v.textContent);
  }
  majTransaction({aide:true, ecartes:qFouille.ecartes});
  rendreFbFouille();
}
function repFouille(val,btn){
  /* Même verrou qu'à la Bourse. La fouille n'expose que des boutons, tous
     désactivés après coup, donc la faille n'y était pas ouverte — mais elle le
     redeviendrait le jour où une question s'y répondrait au clavier. */
  if(!qFouille||qFouille.resolue)return;
  const q=qFouille.q;
  qFouille.marques=qFouille.marques||{};
  if(egal(val,q.r)){
    qFouille.resolue=true; qFouille.juste=true;
    qFouille.marques[String(val)]='bon';
    noterQuestion(q, true);
    /* La bonne réponse est acquise AVANT que la pièce ne soit extraite : si
       l'application se ferme ici, la reprise doit rouvrir la tranchée sur
       « Extraire la pièce », pas reposer la question. */
    majTransaction({statut:'recompense', marques:qFouille.marques});
    rendreFbFouille();
    return;
  }
  qFouille.essais++;
  qFouille.marques[String(val)]='faux';
  btn.classList.add('faux'); btn.disabled=true;
  if(qFouille.essais<NB_ESSAIS){
    majTransaction({essais:qFouille.essais, marques:qFouille.marques});
    rendreFbFouille();
    return;
  }
  qFouille.resolue=true; qFouille.juste=false;
  etat.echecs=(etat.echecs||0)+1;
  noterQuestion(q, false);
  majTransaction({statut:'sterile', essais:qFouille.essais, marques:qFouille.marques});
  rendreFbFouille();
}
/* Une fouille qui ne rend rien est le seul endroit du jeu où l'on perdait
   quelque chose — et il se trouvait du côté du plaisir. Deux réponses fausses
   sur une question de paléontologie transformaient le refuge en second examen.
   Désormais la tranchée livre toujours un fragment : moins qu'une pièce
   complète, jamais rien. */
function trancheeSterile(dejaConsommee){
  /* Sans ce garde, un double-tap sur « Refermer la tranchée » livrait deux
     fragments pour une seule fouille. La transaction n'est consommable qu'une
     fois : c'est la même écriture qui efface la dette et pose la récompense. */
  if(!dejaConsommee && !consommerFouille()) return;
  qFouille=null;
  $('#tranchee').classList.remove('on');
  const pool=creaturesDe(siteActif).filter(c=>possede(c.id));
  if(pool.length){
    const c=pioche(pool);
    /* `avant` et `apres` étaient tous deux mesurés APRÈS l'incrément : ils
       étaient donc toujours égaux, et un éclat qui faisait franchir un palier
       de dossier s'annonçait comme un simple fragment. */
    const avant=niveauDoc(c.id);
    if(!possede(c.id)) noterCreature(c);
    etat.collection[c.id]=fragments(c.id)+1;
    const apres=niveauDoc(c.id);
    sauver();
    return revealCarte(c, apres>avant?'dossier':'fragment', apres, false,
      apres>avant
        ? 'La pièce principale est restée dans la roche, mais les éclats suffisent à compléter le dossier.'
        : 'La pièce principale est restée dans la roche, mais la tranchée a livré des éclats.');
  }
  $('#reveal-corps').innerHTML=`<div class="rev-vide">
    <div class="rev-vide-ico">⛏️</div>
    <div class="rev-vide-t">La pièce est restée dans la roche</div>
    <div class="rev-vide-s">La couche est toujours là. La question reviendra, avec sa réponse en tête.</div>
    <button class="btn-primaire" onclick="fermerReveal()">Revenir au chantier</button></div>`;
  $('#reveal').classList.add('on');
}
/* Le tirage : les créatures inconnues sont favorisées, les doublons
   deviennent des fragments qui enrichissent un dossier. */
function tirage(){
  /* Idempotence. `tirage()` ne se déclenchait qu'à la main, mais rien
     n'empêchait un double-tap sur « Extraire la pièce » de livrer deux
     créatures pour une seule fouille — et rien ne garantissait qu'une fouille
     payée puis interrompue soit honorée. La transaction tranche les deux : elle
     se consomme une fois, et son effacement voyage avec la récompense. */
  if(!consommerFouille()) return;
  qFouille=null;
  $('#tranchee').classList.remove('on');
  if(FOUILLE_VIDE && Math.random()<0.15) return trancheeSterile(true);
  const pool=creaturesDe(siteActif);
  const poids=pool.map(c=>possede(c.id)?1:3);
  let tot=poids.reduce((a,b)=>a+b,0), t=Math.random()*tot, k=0;
  while(t>poids[k]){ t-=poids[k]; k++; }
  const c=pool[k];
  const avant=niveauDoc(c.id);
  if(!possede(c.id)) noterCreature(c);
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
    : type==='nouvelle' ? 'Groupe : '+c.groupe
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
  /* Le chantier est reconstruit dans les deux cas, y compris quand on part vers
     la fiche : son état doit être juste au moment où l'on y revient, pas au
     moment où l'on choisit d'y revenir. */
  if(siteActif) chantier(siteActif);
  /* Consulter la fiche d'une créature qu'on vient de déterrer ne doit pas
     changer d'onglet : on repartait sur la collection, et refermer la fiche
     laissait sur un écran qu'on n'avait pas demandé, loin de la tranchée en
     cours. La fiche est un panneau, elle se superpose à l'écran courant. */
  if(voirFiche) ouvrirFiche(voirFiche);
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
  const ok=revele(c.id), nv=niveauDoc(c.id);
  return `<button class="carte${ok?'':' verrou'}${possede(c.id)?'':' non-trouvee'}" ${possede(c.id)?`onclick="ouvrirFiche('${c.id}')"`:''}>
    ${ok?`<img src="${c.img}" loading="lazy" alt="${esc(c.nom)}">
      <span class="c-niv" title="Niveau documentaire">${'●'.repeat(nv)}${'○'.repeat(3-nv)}</span>
      ${legendeHTML(c.nom)}`
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
      /* Le sceau vaut pour tout groupe, pas seulement pour un chantier : un tri
         par période ou par famille mérite aussi de montrer qu'il est bouclé. */
      const tousLus=s.cs.every(c=>niveauDoc(c.id)>=SEUILS_DOC.length);
      const marque = tousLus ? '<span class="sceau or" title="Tous les dossiers complets">\u2726</span>'
        : trouve===s.cs.length ? '<span class="sceau" title="Toutes les créatures rencontrées">\u2713</span>' : '';
      return `<section class="col-bloc${tousLus?' dore':''}">
        <h3>${esc(s.titre)} <small>${esc(s.sous)}</small>
          <em class="col-part">${trouve} / ${s.cs.length}${marque}</em></h3>
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

   2. Deux chantiers trop proches dans le temps ne peuvent pas porter leurs
      étiquettes au même endroit — Nemegt et Hell Creek sont séparés de deux
      millions d'années, soit seize pixels, moins que la hauteur d'une pastille.

      On sépare donc ce qui doit être exact de ce qui peut bouger. Un REPÈRE
      court, posé sur l'axe, marque la date au pixel près et ne se déplace
      jamais. L'ÉTIQUETTE, elle, glisse verticalement jusqu'à trouver sa place,
      et un filet la relie à son repère. Rien n'est déformé : la position lue
      sur l'axe reste vraie, seul le texte s'écarte, et le filet dit de combien.

      C'est préférable au décalage latéral, qui obligeait à comparer des
      hauteurs sur des colonnes différentes et faisait grimper l'indentation
      avec le nombre de chantiers contemporains.

   3. Les quatre milliards d'années d'avant l'Édiacarien ne tiennent pas à cette
      échelle. Plutôt que de les compresser en silence, on les annonce : à huit
      pixels par million d'années, il faudrait trente et un mètres de haut.

   4. L'échelle étant linéaire, elle se tasse là où l'on ajoute le plus de
      chantiers récents : le Quaternaire entier tient en vingt-et-un pixels.
      C'est le prix d'une échelle honnête, et c'est précisément ce qu'elle doit
      faire sentir. Le décalage latéral du point 2 encaisse l'entassement, et un
      repère « Aujourd'hui » ferme l'axe pour que le présent ne soit pas
      seulement le bas de l'écran.

   Chaque chantier est signalé par une créature EMBLÈME plutôt que par la
   pastille de globe des vues satellites : sur un axe de temps, la position
   géographique ne se lit pas, et vingt-trois globes se ressemblent tous. Une
   silhouette situe l'époque d'un coup d'œil. Voir le bloc 29 de data.js. */
const FRISE_DEBUT=650;          // en Ma ; l'Édiacarien commence à 635
const FRISE_PX_PAR_MA=8;        // hauteur ≈ 5 200 px
const FRISE_ECART_MIN=46;       // en deçà, deux chantiers se décalent de côté
const FRISE_FIN_GARDE=26;       // hauteur réservée au repère « Aujourd'hui »
function yFrise(ma){ return (FRISE_DEBUT-ma)*FRISE_PX_PAR_MA; }
/* periodeDe attend une CRÉATURE (il lit ageMin/ageMax), pas un âge. Lui passer
   un nombre donnait NaN, donc le repli sur la dernière période : tous les
   chantiers s'affichaient « Quaternaire », Lantian compris. */
function periodeSite(id){
  const a=ageMoyenSite(id);
  return (periodeDe({ageMin:a, ageMax:a})||{}).nom||'';
}

function ageMoyenSite(id){
  const cs=CREATURES.filter(c=>c.site===id);
  return cs.reduce((a,c)=>a+(c.ageMin+c.ageMax)/2,0)/cs.length;
}
let friseOuvert=null;

function rendreFrise(){
  const H=yFrise(0)+30;   /* l'axe s'arrête au présent ; les étiquettes y sont bornées */

  const eres=[{nom:'Protérozoïque',de:650,a:538.8},{nom:'Paléozoïque',de:538.8,a:251.9},
              {nom:'Mésozoïque',de:251.9,a:66},{nom:'Cénozoïque',de:66,a:0}];
  const bandes=eres.map((e,i)=>`<div class="fri-ere e${i}"
      style="top:${yFrise(e.de)}px;height:${yFrise(e.a)-yFrise(e.de)}px">
      <span>${esc(e.nom)}</span></div>`).join('');

  const grads=PERIODES.filter(p=>p.de<=FRISE_DEBUT).map(p=>
    `<div class="fri-per" style="top:${yFrise(p.de)}px"><b>${esc(p.nom)}</b><i>${p.de} Ma</i></div>`).join('');

  /* Placement des étiquettes : on descend la liste dans l'ordre du temps et on
     repousse chaque étiquette juste assez pour qu'elle ne recouvre pas la
     précédente. Une seconde passe, remontante, récupère le jeu laissé au-dessus
     quand un groupe serré est suivi d'un vide — sans quoi tout un amas dérive
     vers le bas alors que la place existe plus haut. */
  const rangs=SITES.map(s=>({s, y:yFrise(ageMoyenSite(s.id))})).sort((a,b)=>a.y-b.y);
  rangs.forEach((r,i)=>{
    const mini = i ? rangs[i-1].etiq + FRISE_ECART_MIN : -Infinity;
    r.etiq = Math.max(r.y, mini);
  });
  /* Le présent borne l'axe : une étiquette poussée sous « Aujourd'hui » se
     lirait comme postérieure au présent. La passe remontante part donc de cette
     limite et laisse les étiquettes passer AU-DESSUS de leur repère quand un
     amas récent l'exige — le filet dit l'écart dans un sens comme dans
     l'autre. C'est le cas dès qu'on illustre plusieurs gisements quaternaires,
     tous compris dans les vingt-et-un derniers pixels de la frise. */
  for(let i=rangs.length-1;i>=0;i--){
    /* Le dernier chantier s'arrêtait à yFrise(0), c'est-à-dire exactement où se
       pose le repère « Aujourd'hui » : les deux se superposaient. On réserve
       la hauteur du repère. */
    const maxi = i===rangs.length-1 ? yFrise(0)-FRISE_FIN_GARDE : rangs[i+1].etiq - FRISE_ECART_MIN;
    rangs[i].etiq = Math.min(rangs[i].etiq, maxi);
  }

  const marqueurs=rangs.map(({s,y,etiq})=>{
    const cs=creaturesDe(s.id), n=cs.filter(c=>possede(c.id)).length;
    const ouvert=friseOuvert===s.id;
    const haut=Math.min(y,etiq), bas=Math.max(y,etiq);
    /* Le repère marque la date ; le filet dit de combien l'étiquette s'en
       écarte. Sans écart, pas de filet : rien à expliquer. */
    return `<div class="fri-repere" style="top:${y}px"></div>
    ${bas-haut>1?`<div class="fri-filet" style="top:${haut}px;height:${bas-haut}px"></div>`:''}
    <div class="fri-site${ouvert?' ouvert':''}" style="top:${etiq}px">
      <button class="fri-tete" onclick="friseBascule('${s.id}')">
        <img class="fri-embleme${n?'':' voile'}" src="${emblemeDe(s.id).img}"
             alt="" loading="lazy">
        <span class="fri-nom">${esc(s.court)}
          <em class="fri-epoque">${esc(periodeSite(s.id))}</em></span>
        <span class="fri-cpt">${n} / ${cs.length}${sceau(s.id)}</span>
      </button>
      ${ouvert?`<div class="fri-bêtes">${cs.map(c=>revele(c.id)
          ? `<button class="fri-b" onclick="ouvrirFiche('${c.id}')" title="${esc(c.nom)}">
               <img src="${c.img}" loading="lazy" alt="${esc(c.nom)}"><em>${esc(c.nom)}</em></button>`
          : `<span class="fri-b verrou"><i>?</i><em>Non découverte</em></span>`).join('')}</div>`:''}
    </div>`;
  }).join('');

  $('#col-corps').innerHTML=`
    <p class="fri-aide">Chaque graduation vaut le même nombre d’années. Touche un chantier pour le déplier.</p>
    <div class="fri-avant">
      <b>4,54 milliards d’années avant cette frise</b>
      <span>De la formation de la Terre à l’Édiacarien. À cette échelle, trente et un mètres — et presque rien de visible à l’œil nu.</span>
    </div>
    <div class="fri-axe" style="height:${H}px">
      ${bandes}${grads}<div class="fri-ligne"></div>${marqueurs}
      <div class="fri-fin" style="top:${yFrise(0)}px">
        <b>Aujourd’hui</b><i>0 Ma</i></div>
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
      <p class="rg-note">Si l’application affiche encore l’ancienne version. Aucune progression n’est touchée.</p>
      <button class="btn-primaire" onclick="forcerMaj(this)">Oui, mettre à jour</button>
      <button class="btn-fant" onclick="ouvrirReglages('profil')">Annuler</button>`;
  }else{
    /* Le menu était cinq pastilles identiques empilées : rien n'y hiérarchisait
       ce qui change de partie, ce qui déplace une progression, et ce qui touche
       à l'application. Il est désormais bâti comme une liste groupée — vignette
       et chiffres en tête, actions séparées par familles, action destructrice
       à l'écart et en retrait. */
    const a=apercuProfil(registre.actif);
    html=`<div class="rg-tete">
        <span class="rg-vig">${a.creature
          ? `<img src="${a.creature.img}" alt="">`
          : '<span class="rg-vide">\u25C8</span>'}</span>
        <span class="rg-ident">
          <span class="rg-sur">Partie en cours</span>
          <b class="rg-nom">${esc(p.nom)}</b>
        </span>
      </div>

      <div class="rg-chiffres">
        <span><b>${n}</b><small>créatures<br>sur ${CREATURES.length}</small></span>
        <span><b>${ch}</b><small>chantiers<br>sur ${SITES.length}</small></span>
        <span><b>${etat.credits}</b><small>crédits<br>disponibles</small></span>
      </div>

      <div class="rg-liste">
        <button class="rg-item" onclick="fermerReglages(); ouvrirChoixProfil()">
          <span class="rg-ico">\u21C4</span>
          <span class="rg-lab">Changer de partie<small>Reprendre ou créer une autre progression</small></span>
          <span class="rg-chev">\u203A</span></button>
        <button class="rg-item" onclick="renommerActif()">
          <span class="rg-ico">\u270E</span>
          <span class="rg-lab">Renommer<small>Modifier le nom de cette partie</small></span>
          <span class="rg-chev">\u203A</span></button>
      </div>

      <div class="rg-sauv" id="rg-sauv">
        <div class="rg-vl"><span>Dernière sauvegarde</span><b id="rg-sauv-date">…</b></div>
        <div class="rg-vl"><span>Tu joues dans</span><b id="rg-contexte">…</b></div>
        <p class="rg-avert">Les parties ne vivent que sur cet appareil. <b>Désinstaller l’application les efface définitivement.</b>
          Un fichier de sauvegarde est le seul moyen de les retrouver.</p>
      </div>

      <div class="rg-liste">
        <button class="rg-item" onclick="sauvegarderTout()">
          <span class="rg-ico">\u2193</span>
          <span class="rg-lab">Sauvegarder ${registre.liste.length>1?'toutes les parties':'la partie'}<small>Un seul fichier, qui restaure tout</small></span>
          <span class="rg-chev">\u203A</span></button>
        <button class="rg-item" onclick="choisirFichierImport()">
          <span class="rg-ico">\u2191</span>
          <span class="rg-lab">Restaurer depuis un fichier<small>Ajoute les parties sans écraser les tiennes</small></span>
          <span class="rg-chev">\u203A</span></button>
      </div>

      <div class="rg-liste">
        <button class="rg-item" onclick="fermerReglages(); montrer('carnet')">
          <span class="rg-ico">\u270E</span>
          <span class="rg-lab">Carnet<small>${carnet().length} entrée${carnet().length>1?'s':''}</small></span>
          <span class="rg-chev">\u203A</span></button>
      </div>

      <div class="rg-liste">
        <button class="rg-item" onclick="ouvrirReglages('maj')">
          <span class="rg-ico">\u27F3</span>
          <span class="rg-lab">Forcer la mise à jour<small>Si l’application affiche encore l’ancienne version</small></span>
          <span class="rg-chev">\u203A</span></button>
      </div>

      ${registre.liste.length>1
        ? `<button class="rg-suppr" onclick="supprimerActif()">Supprimer cette partie</button>`
        : ''}

      <div class="rg-vers" id="rg-vers">
        <p class="rg-vers-t">Version</p>
        <div class="rg-vl"><span>Application</span><b>${esc(VERSION_ATLAS)}</b></div>
        <div class="rg-vl"><span>Cache hors ligne</span><b id="rg-cache">…</b></div>
        <div class="rg-vl"><span>Sur le serveur</span><b id="rg-serveur">…</b></div>
        <p class="rg-etat" id="rg-etat">Vérification…</p>
      </div>
      <p class="rg-pied">Tout est enregistré sur cet appareil seulement.
        Format de sauvegarde ${esc(VERSION_APP)}.</p>
      <button class="btn-primaire" onclick="fermerReglages()">Fermer</button>`;
  }
  $('#reglages-corps').innerHTML=html;
  /* Le panneau s'affiche tout de suite ; les deux lignes qui demandent un aller-
     retour se remplissent ensuite. Rien n'attend le réseau pour s'ouvrir. */
  if($('#rg-vers')) majBlocVersion();
  if($('#rg-sauv')) majBlocSauvegarde();
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
    else reprendreFouille();
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
    nom.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); validerAccueil(); } });
  }
  /* Pas de focus automatique : le clavier surgirait aussitôt et masquerait
     l'illustration, qui est la seule raison d'être de cet écran. On laisse
     regarder, on ouvre le clavier quand elle touche le champ. */
  $('#accueil').classList.add('on');
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
      <p class="gd-txt"><b>Bourse.</b> Des questions, des crédits. C’est ce qui finance les fouilles.</p></div>
    <div class="gd-ligne"><span class="gd-ico">⛏️</span>
      <p class="gd-txt"><b>Fouille.</b> Un chantier sur la carte, puis on creuse : chaque bonne réponse dégage une créature.</p></div>
    <div class="gd-ligne"><span class="gd-ico">🧬</span>
      <p class="gd-txt"><b>Collection.</b> Par chantier, par période, par famille, ou sur la frise.</p></div>
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
/* ---------- Vérification de version ----------

   Trois nombres, parce que trois choses peuvent diverger et que le symptôme est
   le même — une application qui ne change pas après un déploiement.

     Application       la version du code effectivement chargé.
     Cache hors ligne  ce que le service worker garde sous la main. S'il reste
                       en retard, c'est lui qui sert des fichiers périmés.
     Sur le serveur    ce qui est en ligne. Lu directement dans sw.js, sans
                       passer par le cache, sinon la question n'aurait pas de
                       sens : on demanderait au cache s'il est à jour.

   Tout se fait au mieux : hors ligne, ou sans service worker, chaque ligne le
   dit plutôt que de mentir ou de rester à trois points de suspension. */
async function nomsCacheAtlas(){
  if(!('caches' in window)) return [];
  try{ return (await caches.keys()).filter(n=>/^atlas-v\d+$/.test(n)); }
  catch(_){ return []; }
}

async function versionEnLigne(){
  /* `cache:'no-store'` court-circuite le cache HTTP ; le paramètre d'horodatage
     court-circuite le service worker, qui ignore la requête faute de la
     reconnaître. Sans ces deux précautions on relit sa propre copie. */
  const r=await fetch('./sw.js?maj='+Date.now(), {cache:'no-store'});
  if(!r.ok) throw new Error('réponse '+r.status);
  const m=(await r.text()).match(/VERSION='atlas-(v\d+)'/);
  if(!m) throw new Error('version illisible');
  return m[1];
}

const numVer=v=>parseInt(String(v).replace(/\D/g,''),10)||0;

async function majBlocVersion(){
  const cache=$('#rg-cache'), serveur=$('#rg-serveur'), etat=$('#rg-etat');
  if(!cache) return;

  const noms=await nomsCacheAtlas();
  const vCache=noms.length?noms.map(n=>n.replace('atlas-','')).join(', '):null;
  cache.textContent = vCache || (('serviceWorker' in navigator)?'aucun':'non géré');

  let vServeur=null, err=null;
  try{ vServeur=await versionEnLigne(); }catch(e){ err=e; }
  serveur.textContent = vServeur || 'hors ligne';

  /* Le diagnostic se lit dans cet ordre : d'abord ce qui est réparable ici. */
  if(vCache && vCache!==VERSION_ATLAS){
    etat.textContent='Le cache est en retard sur le code chargé. Force la mise à jour.';
    etat.className='rg-etat alerte';
  }else if(err){
    etat.textContent='Impossible de joindre le serveur — vérification reportée.';
    etat.className='rg-etat neutre';
  }else if(numVer(vServeur)>numVer(VERSION_ATLAS)){
    etat.textContent='Version '+vServeur+' disponible. Force la mise à jour pour l’installer.';
    etat.className='rg-etat alerte';
  }else{
    etat.textContent='Tout est à jour.';
    etat.className='rg-etat ok';
  }
}

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
      <p class="fi-sur">Nom d’espèce</p>
      <h2>${esc(c.nom)}</h2>
      <p class="fi-groupe"><span>Groupe</span>${esc(c.groupe)}</p>
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
      <div id="doute-hote"></div>
      <button class="lien-doute" onclick="ouvrirDoute('${c.id}','${esc(c.nom)}')">Ça me paraît faux</button>
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
/* Une serie est payee a son propre tarif, quelle que soit sa categorie
   d affichage : c est la forme — beaucoup de recit, peu de questions — qui
   decide, pas le rayon dans lequel elle est rangee. */
const bareme=p=>(p&&p.niveaux ? BAREME.serie : (BAREME[p&&p.cat]||BAREME.base));
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
  /* « 7 / 20 » ne disait pas ce qu'il comptait. Une question est acquise quand
     elle a été réussie SEUIL_MAITRISE fois : on l'écrit. */
  return {txt:m+' questions acquises sur '+b.length
    +' \u00B7 '+SEUIL_MAITRISE+' bonnes réponses chacune', pct:m/b.length*100};
}
function menuPacks(){
  niveauActif=null;
  $('#bourse-corps').innerHTML=`
    <button class="btn-surprise" onclick="missionSurprise()">
      <span class="bs-ico">\u{1F3B2}</span>
      <span class="bs-txt"><b>Mission surprise</b>
        <em>Un pack au hasard \u00B7 gains \u00D7 1,6</em></span></button>
    <h3 class="grp">Séries à niveaux <em>récit d'abord, questions ensuite</em></h3>
    ${PACKS.filter(p=>p.niveaux).map(carteSerie).join('')}
    <h3 class="grp">Histoire et philosophie <em>${BAREME.histoire.juste} \u25C8 par bonne réponse</em></h3>
    ${PACKS.filter(p=>p.cat==='histoire' && !p.niveaux).map(carteP).join('')}
    <h3 class="grp">Accompagnement scolaire
      <em>secondaire inférieur · ${BAREME.ecole.juste} \u25C8 par bonne réponse</em></h3>
    ${PACKS.filter(p=>p.cat==='ecole').map(carteP).join('')}`;
}
/* Une série ne se présente pas comme un pack : on n'y entre pas au hasard, on
   y suit des niveaux dans l'ordre. Chacun s'ouvre sur son récit, se termine par
   six questions, et porte sa marque quand il est acquis. */
function carteSerie(p){
  const N=p.niveaux, faits=N.filter((n,i)=>etat.niveauxFinis && etat.niveauxFinis[p.id+':'+i]).length;
  const ouvert=!!etat.seriesOuvertes[p.id];
  return `<section class="serie${ouvert?' ouverte':''}">
    <button class="se-tete" onclick="basculerSerie('${p.id}')" aria-expanded="${ouvert}">
      <span class="se-ico">${p.ico}</span>
      <span class="se-txt"><b>${esc(p.nom)}</b><small>${esc(p.sous)}</small></span>
      <span class="se-etat">${faits}/${N.length}</span>
      <span class="se-tarif">${BAREME.serie.juste} \u25C8</span>
      <span class="se-fleche">\u203A</span>
    </button>
    ${ouvert ? `<div class="se-corps">${N.map((n,i)=>{
      const fini=etat.niveauxFinis && etat.niveauxFinis[p.id+':'+i];
      const lu=etat.introVue['niv:'+p.id+':'+i];
      return `<button class="niv${fini?' fini':''}" onclick="ouvrirNiveau('${p.id}',${i})">
        <span class="nv-n">${i+1}</span>
        <span class="nv-txt"><b>${esc(n.titre)}</b>
          <small>${n.intro.length} volets \u00B7 ${n.bank().length} questions${fini?' \u00B7 acquis':''}</small></span>
        <span class="nv-etat">${fini?'\u2726':(lu?'\u203A':'\u25CB')}</span></button>
      ${lu?`<button class="nv-revoir" onclick="revoirNiveau('${p.id}',${i})">Revoir le récit</button>`:''}`;
    }).join('')}</div>` : ''}
  </section>`;
}

/* Douze séries dépliées occupaient tout l'écran et noyaient les packs
   ordinaires. Chacune est donc repliée par défaut : on voit son nom, son
   avancement, et l'on déplie ce qu'on veut. L'état est gardé dans le profil,
   pour qu'un aller-retour ne referme pas ce qu'on venait d'ouvrir. */
function basculerSerie(id){
  etat.seriesOuvertes[id]=!etat.seriesOuvertes[id];
  sauver(); menuPacks();
}

function carteP(p){
  const a=avancePack(p), st=statPack(p.id);
  const taux=st.tot?' · réussite '+Math.round(st.ok/st.tot*100)+' %':'';
  return `<button class="pack" onclick="ouvrirPack('${p.id}')">
    <span class="pk-ico">${p.ico}</span>
    <span class="pk-txt"><b>${esc(p.nom)}</b><small>${esc(p.sous)}</small>
      <span class="jauge sm"><i style="width:${a.pct}%"></i></span>
      <small class="pk-st">${esc(a.txt)}${taux}</small></span>
    <span class="pk-go">›</span></button>`;
}
let packActif=null, niveauActif=null;

/* Frontière de profil. `etat` est bien rechargé à chaque bascule, mais les
   variables de session ne l'étaient pas : une mission commencée sur le profil
   A se poursuivait après le passage à B, et ses gains, ses statistiques et sa
   maîtrise s'inscrivaient sur B. Idem pour une tranchée payée et une leçon en
   cours. Tout ce qui vit hors de `etat` est remis à zéro ici, en un seul
   endroit — changement, création, suppression et import de profil. */
function resetSessionTransitoire(){
  mission=null; packActif=null; niveauActif=null;
  qFouille=null; siteActif=null;
  introSiteId=null; introI=0; introRelecture=false;
  ancreGain=null;
  if(typeof fondTimer!=='undefined' && fondTimer){ clearInterval(fondTimer); fondTimer=null; }
  ['intro','tranchee','reveal','fiche','modal'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.classList.remove('on');
  });
}
/* Le rappel est écrit en prose, en paragraphes séparés par une ligne vide. */
function theorieHTML(p){
  return String(p.theorie||'').split(/\n{2,}/)
    .map(par=>'<p>'+esc(par.trim()).replace(/\n/g,'<br>')+'</p>').join('');
}

function ouvrirPack(id){
  packActif=PACKS.find(p=>p.id===id);
  const p=packActif;
  /* L'écran d'un pack portait un objectif, une jauge, une ligne de statistiques
     et un barème. Rien de tout cela n'aide à commencer : la progression est déjà
     lisible sur la carte du pack, dans la liste. Ne restent que le thème, le
     bouton, et le rappel replié. */
  $('#bourse-corps').innerHTML=`
    <div class="pk-tete"><button class="retour" onclick="menuPacks()" aria-label="Retour aux packs">${FLECHE_SVG}<span>Packs</span></button></div>
    <div class="pk-hero">
      <span class="pk-hero-ico">${p.ico}</span>
      <h2 class="pk-nom">${esc(p.nom)}</h2>
      <p class="pk-sous">${esc(p.sous)}</p>
    </div>
    <button class="btn-primaire pk-lancer" onclick="lancerMission()">Commencer une mission</button>
    <details class="theo"><summary>Rappel théorique</summary><div>${theorieHTML(p)}
      <div class="theo-songe">
        <textarea id="sg-pack" rows="2" placeholder="Ce que ça t\u2019inspire"></textarea>
        <button class="carn-mini" onclick="songePackNoter('${p.id}','${esc(p.nom)}')">Inscrire au carnet</button>
      </div>
      <div id="songe-hote"></div>
    </div></details>`;
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
/* Clé de maîtrise d'une question de niveau. Les six questions de CHAQUE niveau
   sont numérotées 1 à 6, et `prog(packId).c` est commun à toute la série : une
   clé réduite à `q.n` ferait entrer en collision niveau 1 question 1, niveau 2
   question 1, etc. — maîtriser le premier niveau les rendrait tous acquis. Le
   rang du niveau fait donc partie de la clé, et `niveauAcquis()` lit EXACTEMENT
   la même. */
function cleNiveau(i,n){ return 'n'+i+':'+n; }

/* Une fiche de niveau n'a pas la forme d'un exercice : elle porte `n` et
   `autres` là où le moteur attend `cle` et `choix`. Sans `cle`, repondre()
   n'enregistrait aucune maîtrise et le niveau restait éternellement inachevé ;
   sans `choix`, rendreExo() basculait sur le champ de saisie et exigeait la
   frappe quasi exacte de réponses conceptuelles longues. La conversion se fait
   ici, en un seul endroit. */
function exoDeNiveau(raw,i){
  const ex={q:raw.q, r:raw.r, exp:raw.exp, cle:cleNiveau(i,raw.n)};
  if(Array.isArray(raw.autres) && raw.autres.length>=2) ex.choix=melange([raw.r,...raw.autres]);
  ex.indice = raw.indice || 'Le récit que tu viens de lire contient la réponse.';
  if(raw.lien) ex.lien=raw.lien;
  if(raw.img)  ex.img=raw.img;
  if(raw.sujet)ex.sujet=raw.sujet;
  return ex;
}
function prochainExo(){
  const p=packActif, niv=packNiv(p.id);
  /* Dans une série, on interroge sur le niveau qu'on vient de lire, jamais sur
     la banque entière : les questions du niveau 3 supposent les niveaux 1 et 2. */
  if(niveauActif!=null && p.niveaux && p.niveaux[niveauActif]){
    const b=p.niveaux[niveauActif].bank();
    const neufs=b.filter(q=>!mission.vus.includes(q.q));
    return exoDeNiveau(melange(neufs.length?neufs:b)[0], niveauActif);
  }
  if(p.id==='conjugaison') return genConjugaison(niv);
  if(p.id==='maths')       return genMaths(niv);
  return choisirBanque(p);
}
let mission=null;
function lancerMission(surprise){
  /* Référence de mission : elle voyage avec chaque exercice enregistré, pour
     que le carnet puisse les regrouper sous une seule entrée dépliable au lieu
     d'aligner six questions isolées. */
  mission={i:0, gagne:0, justes:0, aide:false, essais:0, vus:[], surprise:!!surprise,
           ref:'m'+Date.now()};
  exoSuivant();
}

/* Mission surprise : un pack tiré au sort, mieux payé. Elle existe pour les
   jours où choisir est déjà un effort — on ouvre, on appuie, on part. La prime
   compense le fait de ne pas décider. */
const PRIME_SURPRISE=1.6;

/* Le songe de cours rejoint le carnet comme n'importe quelle trace : la Bourse
   et la Fouille alimentent le même récit. */
function songePack(id, nom){
  const h=document.getElementById('songe-hote'); if(!h) return;
  h.innerHTML=`<textarea class="songe-ed" id="sg-pack" rows="3"
      placeholder="Ce que ce cours t\u2019a laissé"></textarea>
    <button class="carn-mini" onclick="songePackNoter('${id}','${(nom||'').replace(/'/g,"\\'")}')">Inscrire</button>`;
  const z=document.getElementById('sg-pack'); if(z) z.focus();
}
function songePackNoter(id, nom){
  const z=document.getElementById('sg-pack'); const v=z&&z.value.trim();
  if(!v) return;
  carnet().push({k:'pack', t:Date.now(), id:'pack-'+id+'-'+Date.now(),
                 sujet:nom, note:v});
  sauver();
  const h=document.getElementById('songe-hote');
  if(h) h.innerHTML='<span class="doute-ok">Inscrit au carnet.</span>';
}

/* Une mission surprise tire UNE FOIS SUR DEUX dans l'accompagnement scolaire.
   Le reste du temps, dans les packs de culture. Ce n'est pas un hasard corrigé
   mais une intention : la révision scolaire est ce qu'on repousse le plus
   volontiers, et le seul moment où l'on accepte d'en faire est celui où l'on
   a renoncé à choisir.

   ELLE NE TIRE JAMAIS DANS LES SÉRIES À NIVEAUX, et c'est explicite ici parce
   que rien dans les données ne l'interdirait. Une série se suit dans l'ordre :
   ses questions supposent le récit du niveau, qui suppose celui d'avant. Six
   questions tirées au hasard au milieu d'un raisonnement sur l'indétermination
   ne seraient pas une révision mais un contresens — on interrogerait sur une
   histoire qu'on n'a pas lue. Le filtre `!p.niveaux` est donc une règle de
   contenu, pas une commodité. */
const PART_SCOLAIRE=0.5;
function missionSurprise(){
  const encours=packActif&&packActif.id;
  const libres=PACKS.filter(p=>!p.niveaux && p.id!==encours);
  const ecole=libres.filter(p=>p.cat==='ecole');
  const autres=libres.filter(p=>p.cat!=='ecole');
  /* Si l'une des deux familles est vide, on tire dans l'autre plutôt que de
     ne rien lancer : la surprise doit toujours aboutir. */
  let bassin = (Math.random()<PART_SCOLAIRE ? ecole : autres);
  if(!bassin.length) bassin = ecole.length ? ecole : autres;
  if(!bassin.length) bassin = libres.length ? libres : PACKS.filter(p=>!p.niveaux);
  const p=bassin[Math.floor(Math.random()*bassin.length)];
  if(!p) return;
  ouvrirPack(p.id);
  lancerMission(true);
}
function exoSuivant(){
  if(mission.i>=NB_MISSION) return finMission();
  let q=null, garde=0;
  do{ q=prochainExo(); garde++; } while(garde<12 && mission.vus.includes(q.q));
  mission.vus.push(q.q);
  mission.q=q; mission.essais=0; mission.aide=false;
  /* État d'interaction de LA question courante. Il vivait uniquement dans le
     DOM : quitter l'onglet le détruisait, et le retour dans la Bourse ne
     pouvait que redistribuer une question neuve. Il vit désormais dans la
     mission, ce qui rend `rendreExo()` capable de reconstruire à l'identique. */
  mission.juste=false; mission.marques={};
  rendreExo();
}
function rendreExo(){
  fondDefi();                       // une créature différente à chaque question
  const q=mission.q, p=packActif, saisie=!q.choix;
  $('#bourse-corps').innerHTML=`
    <div class="q-tete"><button class="retour" onclick="abandonner()" aria-label="Quitter la mission">${FLECHE_SVG}<span>Quitter</span></button>
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
          ? `<input id="q-input" type="text" placeholder="Ta réponse"
               autocomplete="off" autocorrect="off" autocapitalize="none"
               spellcheck="false" inputmode="text" data-gramm="false"
               autocapitalize="off" enterkeyhint="done">
             <button class="btn-primaire" onclick="repondre($('#q-input').value)">Valider</button>`
          : q.choix.map(c=>{
              const mq=(mission.marques||{})[c]
                     || (mission.resolue && egal(c,q.r) ? 'bon' : '');
              return `<button class="rep${mq?' '+mq:''}"${mission.resolue?' disabled':''}
                onclick="repondre(this.textContent,this)">${esc(c)}</button>`;
            }).join('')}
      </div>
      <button class="btn-indice" id="btn-indice" onclick="montrerIndice()">Voir l'indice</button>
      <button class="carn-mini q-noter" onclick="songeQuestion()">\u270e Prendre une note</button>
      <div id="q-songe"></div>
      <div class="q-fb" id="q-fb"></div>
    </div>`;
  const inp=$('#q-input');
  if(inp){
    inp.disabled=!!mission.resolue;
    if(!mission.resolue){ inp.focus(); inp.addEventListener('keydown',e=>{ if(e.key==='Enter') repondre(inp.value); }); }
  }
  rendreFeedback();
}

/* Le bas de la carte de question — indice, essai raté, correction. Extrait de
   `repondre()` parce qu'il doit pouvoir être REJOUÉ : sans cela, revenir dans
   la Bourse après avoir répondu redonnait une question vierge alors que
   `mission.resolue` restait vrai. Les propositions semblaient actives mais
   `repondre()` les ignorait, et le bouton Continuer n'était plus nulle part :
   la mission était verrouillée. */
function feedbackHTML(q, bon){
  return (bon ? `<b>Juste.</b> ${esc(q.exp||'')}`
              : `<b>Réponse : ${esc(q.r)}.</b> ${esc(q.exp||'')}`)
    +(q.lien?`<div class="q-src"><a href="${esc(q.lien[1]||'#')}" target="_blank" rel="noopener" onclick="lienSuivi('${refExo(q,packActif)}')">${esc(q.lien[0])}</a></div>`:'')
    +`<div id="doute-hote"></div>
      <button class="lien-doute" onclick="ouvrirDoute('${refExo(q,packActif)}','${esc(q.q||'').replace(/'/g,"\\'")}')">Ça me paraît faux</button>
      <button class="btn-primaire" onclick="suite()">Continuer</button>`;
}
function rendreFeedback(){
  if(!mission||!mission.q) return;
  const q=mission.q, fb=$('#q-fb'); if(!fb) return;
  const cacherIndice=()=>{ const b=$('#btn-indice'); if(b) b.style.display='none'; };
  if(mission.resolue){
    cacherIndice();
    /* Verrouillage de la carte. Redondant après un rendu complet — le balisage
       sort déjà désactivé et marqué depuis `mission` — mais indispensable sur
       le chemin vif, où l'on ne redessine pas la carte : la redessiner
       relancerait le fond animé au milieu de la question et effacerait une note
       en cours de frappe. */
    $$('#q-rep .rep, #q-rep button').forEach(x=>{
      x.disabled=true;
      if(x.classList.contains('rep') && egal(x.textContent,q.r)) x.classList.add('bon');
    });
    const inp=$('#q-input'); if(inp) inp.disabled=true;
    fb.className='q-fb '+(mission.juste?'bon':'faux');
    fb.innerHTML=feedbackHTML(q, !!mission.juste);
    return;
  }
  if(mission.aide){
    cacherIndice();
    fb.className='q-fb indice';
    fb.innerHTML='💡 '+esc(q.indice||'Relis l’énoncé en isolant la donnée qui commande la réponse.');
    return;
  }
  if(mission.essais===1){
    fb.className='q-fb retry';
    fb.textContent='Pas encore. Il te reste un essai — l’indice est disponible.';
  }
}
function montrerIndice(){
  if(!mission||!mission.q||mission.resolue) return;
  mission.aide=true;
  rendreFeedback();
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
  /* VERROU. Le champ de saisie et les propositions étaient bien désactivés
     après une bonne réponse, mais pas le bouton « Valider » : on pouvait le
     presser en boucle et encaisser le gain autant de fois qu'on voulait. Le
     garde porte désormais sur l'état de la question, pas sur celui des
     éléments d'interface — il couvre donc tous les chemins, y compris la
     touche Entrée. */
  if(!mission||!mission.q||mission.resolue)return;
  const q=mission.q, bon=egal(val,q.r), b=bareme(packActif);
  ancreGain=btn||null;
  /* Toute trace visible passe par `mission` avant d'atteindre l'écran : c'est
     ce qui permet à `rendreExo()` de reconstituer la question à l'identique
     après un aller-retour vers le Carnet ou la Collection. */
  mission.marques=mission.marques||{};
  if(btn) mission.marques[String(val)]= bon ? 'bon' : 'faux';
  if(bon){
    const autonome = mission.essais===0 && !mission.aide;
    const g = autonome ? b.juste : b.aide;
    /* `justes` est présenté par phraseFin() comme le nombre de questions
       trouvées DU PREMIER COUP. Il ne doit donc compter que les réussites
       autonomes : l'incrémenter après un raté ou après l'indice faisait dire
       à l'écran de fin « six d'emblée » sur une mission à moitié soufflée. */
    mission.gagne+=g; if(autonome) mission.justes++;
    const st=statPack(packActif.id); st.tot++; if(autonome) st.ok++;
    if(q.cle && autonome){ const c=prog(packActif.id).c; c[q.cle]=(c[q.cle]||0)+1; }
    if(packActif.type==='gen' && autonome) prog(packActif.id).reussites++;
    mission.resolue=true; mission.juste=true;
    if(niveauActif!=null) setTimeout(verifierPrimeNiveau,0);
    noterExercice(q, packActif, true);
    rendreFeedback();
    crediter(g); sauver(); return;
  }
  mission.essais++;
  if(mission.essais===1){
    if(btn) btn.classList.add('faux');
    rendreFeedback();
    const inp=$('#q-input'); if(inp) inp.select();
    return;
  }
  mission.resolue=true; mission.juste=false;
  statPack(packActif.id).tot++;
  noterExercice(q, packActif, false);
  rendreFeedback();
  sauver();
}

/* Revenir dans la Bourse ne tire JAMAIS de question : il rejoue l'état courant.
   L'ancien `exoSuivant()` implicite était doublement nuisible.
   - Avant réponse, il remplaçait silencieusement la question et remettait les
     essais à zéro : une question difficile se rerollait gratuitement en
     changeant d'onglet, et une note prise au Carnet coûtait la question.
   - Après réponse mais avant Continuer, il redistribuait une question alors que
     `mission.resolue` restait vrai : les propositions paraissaient actives mais
     `repondre()` les ignorait, et le bouton Continuer n'était plus nulle part.
     La mission était verrouillée.
   `rendreExo()` reconstruit tout depuis `mission` — marques, verrou, indice,
   correction — il n'y a donc rien à rejouer à la main ici. */
function reprendreExo(){
  if(!mission) return menuPacks();
  if(!mission.q) return exoSuivant();   // mission créée par lancerNiveau(), pas encore servie
  rendreExo();
}
function suite(){
  /* Un double-tap sur « Continuer » après la dernière question appelait suite()
     alors que finMission avait déjà rendu son écran : mission.i sur null,
     exception silencieuse. Attrapé en rejouant l'exploit de Louise au harnais. */
  if(!mission) return;
  mission.i++; mission.resolue=false; exoSuivant();
}

/* ---- Niveaux de pack -------------------------------------------------
   Un niveau est une mission de six questions précédée de son récit. Le
   récit porte l'essentiel ; les questions ne font que le fixer. */
function ouvrirNiveau(packId, i){
  const p=PACKS.find(x=>x.id===packId); if(!p||!p.niveaux||!p.niveaux[i])return;
  const cle='niv:'+packId+':'+i;
  /* On ne réimpose pas le récit à chaque passage : vu une fois, il devient
     accessible mais facultatif, comme l'introduction d'un chantier. */
  if(etat.introVue[cle]) lancerNiveau(packId,i); else introSite(cle,false);
}
function revoirNiveau(packId,i){ introSite('niv:'+packId+':'+i, true); }

/* Quitter une leçon en cours. Il n'existait aucune sortie : une fois entré dans
   le récit, on n'en ressortait que par le dernier volet. */
function fermerIntro(){
  /* La même modale sert au récit d'un niveau de série ET à l'introduction d'un
     chantier. Renvoyer systématiquement vers la Bourse téléportait hors du
     chantier qu'on venait d'ouvrir. La sortie rend donc l'écran d'où l'on
     vient, exactement comme le fait introSuivant() au dernier volet. */
  const id=introSiteId, s=sujetIntro(id);
  $('#intro').classList.remove('on');
  introSiteId=null; niveauActif=null; packActif=null; mission=null;
  if(s && s.pack) return montrer('bourse');
  if(id && SITES.some(x=>x.id===id)) siteActif=id;
  montrer('fouille');
}

/* Prendre une note pendant la leçon, sans la quitter. Le récit est le moment
   où une idée arrive ; l'obliger à attendre le carnet, c'est la perdre. */
/* Prendre une note pendant une question. Une bonne question réveille une idée
   au moment précis où elle se pose — pas à la fin de la mission. La note garde
   la question comme sujet, pour que le carnet la resitue. */
function songeQuestion(){
  const h=$('#q-songe'); if(!h||!mission||!mission.q) return;
  h.innerHTML=`<textarea class="songe-ed" id="sg-q" rows="3"
      placeholder="Ce que cette question t\u2019\u00e9voque"></textarea>
    <button class="carn-mini" onclick="songeQuestionNoter()">Inscrire</button>`;
  const z=$('#sg-q'); if(z) z.focus();
}
function songeQuestionNoter(){
  const z=$('#sg-q'); const v=z&&z.value.trim();
  if(!v||!mission||!mission.q) return;
  carnet().push({k:'pack', t:Date.now(), id:'q-'+Date.now(), ref:mission.ref,
                 sujet:(packActif?packActif.nom+' \u00B7 ':'')+mission.q.q.slice(0,80), note:v});
  sauver();
  const h=$('#q-songe');
  if(h) h.innerHTML='<span class="doute-ok">Inscrit au carnet.</span>';
}

function songeIntro(){
  const h=$('#intro-songe'); if(!h) return;
  const s=sujetIntro(introSiteId); if(!s) return;
  h.innerHTML=`<textarea class="songe-ed" id="sg-intro" rows="3"
      placeholder="Ce que ce passage t\u2019a laissé"></textarea>
    <button class="carn-mini" onclick="songeIntroNoter()">Inscrire</button>`;
  const z=$('#sg-intro'); if(z) z.focus();
}
function songeIntroNoter(){
  const z=$('#sg-intro'); const v=z&&z.value.trim();
  const s=sujetIntro(introSiteId);
  if(!v||!s) return;
  carnet().push({k:'pack', t:Date.now(), id:'lecon-'+introSiteId+'-'+Date.now(),
                 sujet:s.nom+' \u00B7 volet '+(introI+1), note:v});
  sauver();
  const h=$('#intro-songe');
  if(h) h.innerHTML='<span class="doute-ok">Inscrit au carnet.</span>';
}

function lancerNiveau(packId, i){
  const p=PACKS.find(x=>x.id===packId); if(!p||!p.niveaux||!p.niveaux[i])return;
  packActif=p; niveauActif=i;
  /* La première version fabriquait un objet mission d'une forme inventée, sans
     vus, gagne, justes ni essais. exoSuivant() faisait mission.vus.push(...)
     sur undefined, l'exception partait en silence, et l'on restait sur le
     dernier volet sans qu'aucune question n'apparaisse jamais. La mission d'un
     niveau doit avoir EXACTEMENT la forme de celle d'un pack : seule la
     provenance des questions change. */
  mission={i:0, gagne:0, justes:0, aide:false, essais:0, vus:[], surprise:false,
           ref:'niv:'+packId+':'+i, niveau:i};
  montrer('bourse');
}

/* Un niveau est acquis quand chacune de ses six questions a été réussie
   SEUIL_MAITRISE fois. La prime ne tombe qu'une fois. */
function niveauAcquis(packId,i){
  const p=PACKS.find(x=>x.id===packId); if(!p||!p.niveaux||!p.niveaux[i])return false;
  const c=prog(packId).c||{};
  return p.niveaux[i].bank().every(q=>(c[cleNiveau(i,q.n)]||0)>=SEUIL_MAITRISE);
}
function verifierPrimeNiveau(){
  if(!packActif || niveauActif==null) return;
  const cle=packActif.id+':'+niveauActif;
  etat.niveauxFinis=etat.niveauxFinis||{};
  if(etat.niveauxFinis[cle] || !niveauAcquis(packActif.id, niveauActif)) return;
  etat.niveauxFinis[cle]=true;
  etat.credits+=PRIME_NIVEAU;
  const n=packActif.niveaux[niveauActif];
  noterEvenement('pack', {id:'fin-'+cle, site:packActif.id,
    sujet:'Niveau achevé — '+n.titre,
    note:'Les six questions sont acquises. Prime : '+PRIME_NIVEAU+' \u25C8.'});
  majSolde(); sauver();
  toast('Niveau achevé \u00B7 +'+PRIME_NIVEAU+' \u25C8');
}
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
  if(justes===0) return 'Six questions, six explications lues.';
  if(justes===1) return 'Une trouvée du premier coup, et cinq explications de plus en tête.';
  return justes+' trouvées du premier coup, le reste après un détour par l’explication.';
}
function finMission(){
  const b=bareme(packActif);
  const brut=b.mission;
  const prime=mission.surprise ? Math.round(brut*(PRIME_SURPRISE-1)) : 0;
  const total=mission.gagne+crediter(brut+prime);
  const a=avancePack(packActif);
  const manque=Math.max(0, COUT_FOUILLE-etat.credits);
  $('#bourse-corps').innerHTML=`
    <div class="fin">
      <div class="fin-credits">+${total} \u25C8${prime?`<em>dont ${prime} de prime</em>`:''}</div>
      <p class="fin-score">${phraseFin(mission.justes)}</p>
      <button class="btn-primaire" onclick="lancerMission()">Continuer</button>
      <button class="btn-fant" onclick="montrer('fouille')">Aller fouiller</button>
    </div>`;
  mission=null; sauver();
}

/* ---------------- 7. Initialisation ---------------- */
function init(){
  $$('nav.tabs button').forEach(b=>b.addEventListener('click',()=>montrer(b.dataset.ecran)));
  /* Le clic n'importe où faisait avancer le volet — pratique pour lire, mais
     il AVALAIT tout : la croix, la prise de note, les liens, le bouton
     précédent. On n'avance donc que si le clic touche le fond de l'écran ou le
     texte lui-même, jamais un élément actif ni ses enfants. */
  $('#intro').addEventListener('click',e=>{
    if(e.target.closest('a,button,textarea,input,.dots,.intro-liens,.intro-songe')) return;
    introSuivant();
  });
  $('#btn-fouiller').addEventListener('click',fouiller);
  $('#ch-retour').addEventListener('click',vueCarte);
  armerBalayageIntro();
  $('#ch-retour-bas').addEventListener('click',vueCarte);
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
  /* Une fouille payée avant la fermeture de l'onglet est due : on la rouvre
     avant tout le reste, sinon la joueuse retrouve un solde amputé sans savoir
     pourquoi. Elle ne s'affiche pas par-dessus le choix de profil : dans ce
     cas c'est basculerProfil() qui la reprendra, sur la bonne partie. */
  /* Une seule partie : on entre directement, l'écran de choix serait une
     formalité. Plusieurs : on demande, parce que se tromper de partie ne se
     voit qu'après coup. */
  if(registre.liste.length>1) ouvrirChoixProfil();
  else if(besoinAccueil()) ouvrirAccueil();
  else reprendreFouille();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
document.addEventListener('DOMContentLoaded',init);

/* ================================================================
   Carnet de parcours.

   La collection dit ce qui manque. Le carnet dit où l'on est allé :
   même chiffre, sens inverse. Il enregistre les exercices traversés,
   leur explication, leur source, et les doutes soulevés.

   Volontairement sans score, sans pourcentage, sans série. Un tableau
   de bord redeviendrait une complétion, donc une chose à ignorer.
   ================================================================ */

/* AUCUN PLAFOND, AUCUN ÉLAGAGE. Le carnet est un carnet de terrain : on n'en
   arrache pas de pages, pas même les plus anciennes, pas même pour faire de la
   place. Une entrée n'en sort que si Louise la supprime elle-même.

   Ordre de grandeur pour lever le doute : une entrée pèse quelques centaines
   d'octets. Dix mille entrées tiennent dans quelques mégaoctets, très en deçà
   de ce que localStorage accepte, et il faudrait des années d'usage quotidien
   pour y arriver. Le plafond n'aurait rien protégé et aurait tout coûté. */

function carnet(){ return (etat.carnet=etat.carnet||[]); }

/* Une entrée par question traversée. On garde l'énoncé et l'explication en
   clair : le carnet doit rester lisible même si la banque change ensuite. */
function noterQuestion(q, juste){
  const c=carnet();
  if(c.some(e=>e.k==='q' && e.id===q.id)) return;   /* une trace par question */
  c.push({k:'q', t:Date.now(), id:q.id, site:q.site||'',
          q:q.q, r:q.r, exp:q.exp||'',
          src:q.src&&q.src[1]?[q.src[0],q.src[1]]:null, lien:false, juste:!!juste});
  sauver();
}

function noterEvenement(k, champs){
  const c=carnet();
  if(champs.id && c.some(e=>e.k===k && e.id===champs.id)) return;
  c.push(Object.assign({k, t:Date.now()}, champs));
  sauver();
}

/* Les exercices de la Bourse n'ont pas d'identifiant stable : on en fabrique
   un depuis le pack et l'énoncé, pour ne pas noter deux fois la même question
   et pour que le lien puisse être marqué comme suivi. */
function refExo(q, pack){
  const base=(pack&&pack.id||'x')+'|'+(q.q||q.cle||'');
  let h=0; for(let i=0;i<base.length;i++) h=(h*31+base.charCodeAt(i))|0;
  return 'ex'+Math.abs(h).toString(36);
}
function noterExercice(q, pack, juste){
  noterEvenement('q', {id:refExo(q,pack), site:'', pack:pack&&pack.nom||'',
    mis:(mission&&mission.ref)||'',
    q:q.q||q.cle||'', r:q.r, exp:q.exp||'',
    src:q.lien&&q.lien[1]?[q.lien[0],q.lien[1]]:null, lien:false, juste:!!juste});
}

function noterCreature(cr){
  noterEvenement('creature', {id:cr.id, nom:cr.nom, img:cr.img, site:cr.site,
    detail:[cr.groupe, cr.age].filter(Boolean).join(' · ')});
}
function noterChantier(s){
  noterEvenement('chantier', {id:s.id, nom:s.nom, site:s.id,
    detail:[s.region, s.ere].filter(Boolean).join(' · ')});
}

function lienSuivi(id){
  const e=carnet().find(x=>x.id===id);
  if(e && !e.lien){ e.lien=true; sauver(); }
}

/* Le réflexe de Louise devant une inexactitude est un atout, pas un agacement :
   on l'enregistre au lieu de le laisser se perdre. La liste s'exporte. */
/* Un doute porte un identifiant propre : deux boîtes ouvertes en même temps
   (une explication et une fiche) ne doivent pas se voler leur champ de saisie. */
let douteN=0;

function douter(ref, id, sujet){
  const z=document.getElementById('doute-txt-'+ref);
  const t=z&&z.value.trim();
  if(!t) return;
  carnet().push({k:'doute', t:Date.now(), id:id||'', sujet:sujet||'', note:t, resolu:false});
  sauver();
  const b=document.getElementById('doute-boite-'+ref);
  if(b) b.innerHTML='<span class="doute-ok">Noté au carnet.</span>';
}

function ouvrirDoute(id, sujet){
  const h=document.getElementById('doute-hote');
  if(!h) return;
  const ref=++douteN;
  h.innerHTML=`<div class="doute" id="doute-boite-${ref}">
    <textarea id="doute-txt-${ref}" rows="2" placeholder="Ce qui te paraît faux, et pourquoi"></textarea>
    <button onclick="douter(${ref},'${id}','${(sujet||'').replace(/'/g,"\\'")}')">Noter au carnet</button>
  </div>`;
}

const CARN_TYPES={
  q:       {ico:'\u2753', lab:'Exercice'},
  creature:{ico:'\u2726', lab:'Découverte'},
  chantier:{ico:'\u26CF', lab:'Chantier'},
  pack:    {ico:'\u270E', lab:'Note de cours'},
  note:    {ico:'\u270E', lab:'Note'},
  doute:   {ico:'\u26A0', lab:'Doute'}
};

const CARN_FILTRES=[['tout','Tout'],['songes','Songes'],['q','Exercices'],
  ['creature','Découvertes'],['chantier','Chantiers'],['pack','Cours'],
  ['note','Notes'],['doute','Doutes'],['liens','Liens']];

/* Les liens ne sont pas un type d'entrée mais une VUE : toutes les sources
   rencontrées, dédoublonnées, celles suivies marquées. C'est la bibliothèque
   que le parcours a constituée sans qu'on la range. Un songe peut s'y
   accrocher : rouvrir un lien un mois plus tard, c'est retrouver le lien ET ce
   qu'on en avait tiré. */
function carnetLiens(){
  const vus=new Map();
  carnet().filter(e=>e.src&&e.src[1]).forEach(e=>{
    const k=e.src[1];
    const p=vus.get(k)||{titre:e.src[0], url:k, lien:false, n:0, site:e.site||'',
                         t:e.t, id:e.id, songe:e.songe};
    p.lien=p.lien||!!e.lien; p.n++;
    if(e.songe && !p.songe){ p.songe=e.songe; p.t=e.t; p.id=e.id; }
    vus.set(k,p);
  });
  return [...vus.values()].sort((a,b)=>(b.lien?1:0)-(a.lien?1:0)||a.titre.localeCompare(b.titre));
}

function ajouterNote(){
  const z=document.getElementById('carn-note-txt');
  const t=z&&z.value.trim();
  if(!t) return;
  carnet().push({k:'note', t:Date.now(), note:t});
  sauver(); rendreCarnet();
}

function carnetFiltrer(f){ etat.carnetTri=f; sauver(); rendreCarnet(); }
function carnetOrdre(){ etat.carnetOrdre=etat.carnetOrdre==='asc'?'desc':'asc'; sauver(); rendreCarnet(); }
function carnetGroupe(){ etat.carnetGroupe=!etat.carnetGroupe; sauver(); rendreCarnet(); }
function carnetChercher(v){ carnetQ=v; rendreCarnet(); }
let carnetQ='';

/* Ses propres notes lui appartiennent : elle doit pouvoir les corriger et les
   effacer. Les entrées automatiques — exercices, découvertes — se suppriment
   aussi : le carnet est à elle, pas un journal système. */
function carnetSupprimer(t){
  const c=carnet(), i=c.findIndex(e=>e.t===t);
  if(i<0) return;
  c.splice(i,1); sauver(); rendreCarnet();
}
function carnetEditer(t){
  const c=carnet(), e=c.find(x=>x.t===t);
  if(!e) return;
  const z=document.getElementById('ed-'+t);
  if(!z){ rendreCarnet(); return; }
  e.note=z.value.trim(); sauver(); rendreCarnet();
}
function carnetOuvrirEdition(t){
  const e=carnet().find(x=>x.t===t); if(!e) return;
  const h=document.getElementById('corps-'+t); if(!h) return;
  h.innerHTML=`<textarea class="carn-ed" id="ed-${t}" rows="3">${esc(e.note||'')}</textarea>
    <button class="carn-mini" onclick="carnetEditer(${t})">Enregistrer</button>
    <button class="carn-mini" onclick="rendreCarnet()">Annuler</button>`;
}
/* LE SONGE.

   Toute entrée du carnet peut recevoir un songe : ce que Louise en a pensé,
   ce qu'elle a compris de travers, ce que le lien lui a appris. C'est la
   couche qui transforme un relevé en récit — le relevé dit ce qui est arrivé,
   le songe dit ce que ça lui a fait.

   Il s'accroche à l'entrée plutôt que de vivre à côté : rouvrir un lien un
   mois plus tard, c'est retrouver le lien ET ce qu'on en avait tiré. */
function songeOuvrir(t){
  const e=carnet().find(x=>x.t===t); if(!e) return;
  const h=document.getElementById('songe-'+t); if(!h) return;
  h.innerHTML=`<textarea class="songe-ed" id="sg-${t}" rows="3"
      placeholder="Ce que ça t’inspire, ce que tu en retiens, ce qui cloche">${esc(e.songe||'')}</textarea>
    <button class="carn-mini" onclick="songeNoter(${t})">Inscrire</button>
    <button class="carn-mini" onclick="rendreCarnet()">Annuler</button>`;
  const z=document.getElementById('sg-'+t); if(z) z.focus();
}
function songeNoter(t){
  const e=carnet().find(x=>x.t===t); if(!e) return;
  const z=document.getElementById('sg-'+t); if(!z) return;
  const v=z.value.trim();
  if(v) { e.songe=v; e.songeT=Date.now(); } else { delete e.songe; delete e.songeT; }
  sauver(); rendreCarnet();
}

/* Un doute résolu n'est pas un doute effacé : il reste, barré, avec sa date. */
function carnetResoudre(t){
  const e=carnet().find(x=>x.t===t); if(!e) return;
  e.resolu=!e.resolu; sauver(); rendreCarnet();
}

function rendreCarnet(){
  const corps=document.getElementById('carn-corps');
  const tri=document.getElementById('carn-tri');
  if(!corps) return;
  const f=etat.carnetTri||'tout';
  const asc=etat.carnetOrdre!=='desc';   // le carnet se remplit vers le bas

  /* Pas de filtres par type — c'était de l'appareillage avant l'usage. Reste
     une bascule entre deux LECTURES du même carnet : le parcours, et la
     bibliothèque de liens qu'il a constituée. */
  if(tri) tri.innerHTML=carnet().some(e=>e.src&&e.src[1])
    ? `<button class="carn-vue${f!=='liens'?' on':''}" onclick="carnetFiltrer('tout')">Parcours</button>
       <button class="carn-vue${f==='liens'?' on':''}" onclick="carnetFiltrer('liens')">Liens</button>`
    : '';

  const cpt=document.getElementById('carn-compte');
  if(cpt) cpt.textContent=carnet().length+' entrée'+(carnet().length>1?'s':'');

  const barre = carnet().length>8 ? `<div class="carn-barre">
    <input id="carn-q" class="carn-q" type="search" placeholder="Chercher"
           value="${esc(carnetQ)}" oninput="carnetChercher(this.value)">
  </div>` : '';

  const saisie=`<div class="carn-saisie">
    <textarea id="carn-note-txt" rows="2" placeholder="Ajouter une note libre"></textarea>
    <button onclick="ajouterNote()">Noter</button>
    <button class="carn-exp" onclick="exporterCarnet()">Copier</button>
    <button class="carn-exp" onclick="telechargerCarnet()">Télécharger</button>
    <textarea id="carnet-export" class="carnet-export" readonly style="display:none"></textarea>
  </div>`;

  if(f==='liens'){
    const L=carnetLiens().filter(l=>!carnetQ||(l.titre+' '+l.url).toLowerCase().includes(carnetQ.toLowerCase()));
    corps.innerHTML=barre+(L.length
      ? `<div class="carn-liens">${L.map(l=>`<div class="carn-lien${l.lien?' lu':''}">
           <a href="${esc(l.url)}" target="_blank" rel="noopener" onclick="lienSuivi('${l.id}')">
             <b>${esc(l.titre)}</b>
             <small>${l.lien?'déjà ouvert':'jamais ouvert'}${l.n>1?' · '+l.n+' questions':''}</small></a>
           ${l.songe?`<blockquote class="songe">${esc(l.songe)}
             <button class="songe-mod" onclick="songeOuvrir(${l.t})">\u270E</button></blockquote>`
            :`<button class="carn-mini songe-add" onclick="songeOuvrir(${l.t})">Inscrire un songe</button>`}
           <div id="songe-${l.t}"></div></div>`).join('')}</div>`
      : `<p class="carnet-vide">Les sources rencontrées se rangeront ici.</p>`)+saisie;
    return;
  }

  const texte=e=>[e.q,e.r,e.exp,e.nom,e.detail,e.sujet,e.note,e.songe].filter(Boolean).join(' ').toLowerCase();
  /* « Songes » n'est pas un type d'entrée mais une lecture : toutes les traces
     qui en portent un, quel que soit ce qui les a déclenchées. C'est la ligne
     de temps de ce qu'elle a pensé, détachée de ce qu'elle a fait. */
  let c=carnet().filter(e=>(f==='tout' ? true : f==='songes' ? !!e.songe : e.k===f)
      && (!carnetQ||texte(e).includes(carnetQ.toLowerCase())));
  c=[...c].sort((a,b)=>asc?a.t-b.t:b.t-a.t);

  if(!c.length){
    corps.innerHTML=`<p class="carnet-vide">${carnetQ?'Rien qui corresponde.':'Ce que tu traverses s\u2019inscrira ici.'}</p>`+saisie;
    return;
  }

  const nomSite=id=>{const s=SITES.find(x=>x.id===id); return s?s.court:'Hors chantier';};
  const jour=t=>new Date(t).toLocaleDateString('fr-BE',{day:'numeric',month:'long',year:'numeric'});
  const tete=e=>etat.carnetGroupe?nomSite(e.site):jour(e.t);

  /* Une mission d'entraînement produit six exercices d'affilée. Alignés, ils
     noient tout le reste ; regroupés sous une seule entrée dépliable, ils
     racontent une séance. On ne regroupe que les suites consécutives, pour ne
     pas mélanger deux passages sur le même pack à des jours d'écart. */
  const lots=[];
  c.forEach(e=>{
    const d=lots[lots.length-1];
    if(e.k==='q' && e.mis && d && d.mis===e.mis) d.items.push(e);
    else lots.push(e.k==='q'&&e.mis ? {mis:e.mis, items:[e]} : {seul:e});
  });

  let out='', dernier='';
  lots.forEach(lot=>{
    if(lot.mis && lot.items.length>1){
      const p=lot.items[0], h=tete(p);
      if(h!==dernier){ out+=`<div class="carnet-jour">${esc(h)}</div>`; dernier=h; }
      const justes=lot.items.filter(x=>x.juste).length;
      const songes=lot.items.filter(x=>x.songe).length;
      out+=`<details class="carnet-e t-q lot${songes?' a-songe':''}">
        <summary><span class="carn-ico">\u{1F393}</span>
          <span class="carn-resume"><b>${esc(p.pack||'Mission')}</b>
            <small>${lot.items.length} questions \u00B7 ${justes} juste${justes>1?'s':''}${songes?' \u00B7 '+songes+' songe'+(songes>1?'s':''):''}</small>
          </span></summary>
        <div class="lot-corps">${lot.items.map(x=>entree(x,true)).join('')}</div>
      </details>`;
      return;
    }
    const e=lot.seul||lot.items[0];
    const h=tete(e);
    if(h!==dernier){ out+=`<div class="carnet-jour">${esc(h)}</div>`; dernier=h; }
    out+=entree(e,false);
  });

  corps.innerHTML=barre+`<div class="carn-fil">${out}</div>`+saisie;
  requestAnimationFrame(()=>window.scrollTo(0, document.body.scrollHeight));

  /* Rendu d'une entrée, isolée ou prise dans un lot de mission. */
  function entree(e, dansLot){
    const T=CARN_TYPES[e.k]||CARN_TYPES.note;
    let inner='';
    if(e.k==='q'){
      inner=`<b>${esc(e.q)}</b><p>${esc(e.r)} — ${esc(e.exp)}</p>`
        +(e.src?`<a href="${esc(e.src[1])}" target="_blank" rel="noopener"
            onclick="lienSuivi('${e.id}')" class="${e.lien?'lu':''}">${esc(e.src[0])}</a>`:'');
    }else if(e.k==='creature'){
      /* Le résumé porte déjà le nom : le corps ne le répète pas. */
      inner=`<button class="carn-ouvre" onclick="ouvrirFiche('${e.id}')">
          ${e.img?`<img class="carn-vign" src="${esc(e.img)}" loading="lazy" alt="">`:''}
          <span><p>${esc(e.detail||'')}</p></span></button>`;
    }else if(e.k==='chantier'){
      inner=`<button class="carn-ouvre" onclick="allerChantier('${e.id}')">
          <span><p>${esc(e.detail||'')}</p></span></button>`;
    }else if(e.k==='pack'||e.k==='doute'){
      inner=`<p>${esc(e.note||'')}</p>`;
    }else{
      inner='';
    }
    const modifiable=(e.k==='note'||e.k==='doute'||e.k==='pack');
    /* Repliée par défaut : le carnet capte beaucoup, et une pile de blocs
       dépliés devient illisible bien avant la centième entrée. Le résumé donne
       de quoi reconnaître la trace, le détail s'ouvre à la demande. Un songe
       reste visible plié — c'est ce qu'on revient chercher. */
    const resume=e.q||e.nom||e.sujet||e.note||T.lab;
    const songe=e.songe
      ? `<blockquote class="songe">${esc(e.songe)}
           <button class="songe-mod" onclick="songeOuvrir(${e.t})" title="Modifier">\u270E</button>
         </blockquote>`
      : '';
    /* Ouvertes d'emblée : les découvertes, parce que l'image est la
       récompense, et tout ce qu'elle a écrit elle-même. Le reste se déplie à
       la demande. */
    const ouvrir=(e.k==='creature'||e.k==='note'||e.k==='pack'||e.k==='doute') && !dansLot;
    return `<details class="carnet-e t-${e.k}${e.resolu?' resolu':''}${e.songe?' a-songe':''}${dansLot?' dans-lot':''}"${ouvrir?' open':''}>
      <summary><span class="carn-ico" title="${T.lab}">${T.ico}</span>
        <span class="carn-resume">${esc(resume)}</span></summary>
      <div class="carn-txt"><div id="corps-${e.t}">${inner}</div>
        ${songe}
        <div id="songe-${e.t}"></div>
        <div class="carn-actions">
          ${e.songe?'':`<button class="carn-mini songe-add" onclick="songeOuvrir(${e.t})">Inscrire un songe</button>`}
          ${e.k==='doute'?`<button class="carn-mini" onclick="carnetResoudre(${e.t})">${e.resolu?'Rouvrir':'Résolu'}</button>`:''}
          ${modifiable?`<button class="carn-mini" onclick="carnetOuvrirEdition(${e.t})">Modifier</button>`:''}
          <button class="carn-mini" onclick="carnetSupprimer(${e.t})">Retirer</button>
        </div></div></details>`;
  }
}

/* Se rendre au chantier depuis le carnet : on ne relit pas une trace sans
   pouvoir y retourner. */
function allerChantier(id){
  if(!SITES.some(s=>s.id===id)) return;
  montrer('fouille');
  if(etat.sitesOuverts[id]) chantier(id);
}

function telechargerCarnet(){
  const txt=texteCarnet();
  const b=new Blob([txt],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(b);
  a.download='carnet-'+new Date().toISOString().slice(0,10)+'.txt';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
}

function texteCarnet(){
  const c=[...carnet()].sort((a,b)=>a.t-b.t);
  const d=t=>new Date(t).toLocaleDateString('fr-BE');
  let txt='Carnet — Gronosaures et Trilobytes\n\n';
  const ouverts=c.filter(e=>e.k==='doute'&&!e.resolu);
  const clos=c.filter(e=>e.k==='doute'&&e.resolu);
  if(ouverts.length){
    txt+='À VÉRIFIER\n';
    ouverts.forEach(e=>{ txt+='- ['+d(e.t)+'] '+(e.sujet||e.id)+' : '+e.note+'\n'; });
    txt+='\n';
  }
  if(clos.length){
    txt+='DOUTES RÉSOLUS\n';
    clos.forEach(e=>{ txt+='- ['+d(e.t)+'] '+(e.sujet||e.id)+' : '+e.note+'\n'; });
    txt+='\n';
  }
  const notes=c.filter(e=>e.k==='note'||e.k==='pack');
  if(notes.length){
    txt+='NOTES\n';
    notes.forEach(e=>{ txt+='- ['+d(e.t)+'] '+(e.sujet?e.sujet+' : ':'')+(e.note||'')+'\n'; });
    txt+='\n';
  }
  const dec=c.filter(e=>e.k==='creature'||e.k==='chantier');
  if(dec.length){
    txt+='RENCONTRES\n';
    dec.forEach(e=>{ txt+='- ['+d(e.t)+'] '+e.nom+(e.detail?' — '+e.detail:'')+'\n'; });
    txt+='\n';
  }
  const songes=c.filter(e=>e.songe);
  if(songes.length){
    txt+='SONGES\n';
    songes.forEach(e=>{
      const quoi=e.q||e.nom||e.sujet||e.note||'';
      txt+='- ['+d(e.songeT||e.t)+'] '+quoi+'\n  « '+e.songe+' »\n';
    });
    txt+='\n';
  }
  txt+='PARCOURS\n';
  c.filter(e=>e.k==='q').forEach(e=>{
    txt+='- '+e.q+'\n  '+e.r+' — '+e.exp+'\n';
    if(e.src) txt+='  '+e.src[0]+' '+e.src[1]+(e.lien?' (suivi)':'')+'\n';
    if(e.songe) txt+='  songe : '+e.songe+'\n';
  });
  return txt;
}

function exporterCarnet(){
  const txt=texteCarnet();
  const zone=document.getElementById('carnet-export');
  if(zone){ zone.value=txt; zone.style.display='block'; zone.select(); }
  if(navigator.clipboard) navigator.clipboard.writeText(txt).catch(()=>{});
}
