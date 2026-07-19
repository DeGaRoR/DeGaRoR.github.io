/* ================================================================
   tools/qc.js — porte de qualité de l'Atlas.
   Usage : node --check data.js && node --check app.js && node tools/qc.js
   La livraison n'est valide que si la sortie affiche « ÉCHECS (0) ».
   Le harness ne touche pas au DOM : il n'évalue que data.js et
   contrôle app.js / index.html / sw.js par analyse de texte.
   ================================================================ */
'use strict';
const fs=require('fs'), path=require('path');
const R=path.resolve(__dirname,'..');
const lire=f=>fs.readFileSync(path.join(R,f),'utf8');
const existe=f=>fs.existsSync(path.join(R,f));

let ok=0; const echecs=[];
function T(nom,cond,detail){ if(cond){ok++;} else echecs.push(nom+(detail?' — '+detail:'')); }

/* --- Charger data.js dans un contexte neutre --- */
const src=lire('data.js');
const sandbox={};
try{ (new Function(src+'\n;Object.assign(this,{CREATURES,QUIZ_PALEO,SITES,PACKS,ORTHO,GEN_MATHS,'
  +'TEMPS,PERS,PERS_LBL,VER_ER,VER_IR,VER_IRR,AUX_ETRE,conjuguer,participe,sujetPour,verbesNiv,'
  +'COUT_FOUILLE,CREDITS_DEPART,BAREME,GAIN_MISSION,NB_MISSION,BONUS_SITE,BONUS_PART,HISTOIRE,'
  +'CARTE_ZOOM_MIN,CARTE_GROUPE,CARTE_LARGEUR_MIN,'
  +'SEUILS_DOC,FOUILLE_VIDE});')).call(sandbox); }
catch(e){ console.error('data.js illisible :',e.message); process.exit(1); }
const {CREATURES,QUIZ_PALEO,SITES,PACKS,ORTHO,HISTOIRE,GEN_MATHS,TEMPS,conjuguer,participe,
       sujetPour,verbesNiv,VER_IRR,SEUILS_DOC,COUT_FOUILLE,CREDITS_DEPART,NB_MISSION,
       BAREME,BONUS_SITE,BONUS_PART,CARTE_ZOOM_MIN,CARTE_GROUPE,CARTE_LARGEUR_MIN}=sandbox;

/* ---------- 1. Fichiers attendus ---------- */
['index.html','styles.css','data.js','app.js','sw.js','manifest.json','monde.jpg']
  .forEach(f=>T('fichier '+f, existe(f)));

/* ---------- 2. Créatures ---------- */
T('110 créatures', CREATURES.length===110, CREATURES.length+' trouvées');
const ids=new Set();
CREATURES.forEach(c=>{
  T('id unique '+c.id, !ids.has(c.id)); ids.add(c.id);
  T('image présente '+c.id, existe(c.img), c.img);
  ['nom','groupe','periode','age','desc','prudence','conf','milieu','regime','taille']
    .forEach(k=>T('champ '+k+' non vide ('+c.id+')', !!(c[k]&&String(c[k]).trim())));
  T('bornes d’âge cohérentes '+c.id, c.ageMax>=c.ageMin && c.ageMin>0);
  T('confiance graphique 1-5 '+c.id, c.confN>=1&&c.confN<=5);
  T('au moins une source '+c.id, c.src.some(s=>s&&s[1]&&/^https?:\/\//.test(s[1])));
  T('site déclaré '+c.id, SITES.some(s=>s.id===c.site), c.site);
});

/* ---------- 3. Sites ---------- */
T('dix-huit sites', SITES.length===18, SITES.length+'');
SITES.forEach(s=>{
  T('fond satellite '+s.id, existe(s.fond), s.fond);
  T('au moins six créatures pour '+s.id, CREATURES.filter(c=>c.site===s.id).length>=6,
    CREATURES.filter(c=>c.site===s.id).length+'');
  T('pin dans la carte '+s.id, s.x>0&&s.x<1535&&s.y>0&&s.y<1024, s.x+','+s.y);
  T('introduction développée '+s.id, Array.isArray(s.intro)&&s.intro.length>=5, (s.intro||[]).length+' volets');
  s.intro.forEach((p,i)=>T('volet '+(i+1)+' substantiel ('+s.id+')', p.length>200, p.length+' car.'));
  T('coût de déblocage '+s.id, s.cout>0, String(s.cout));
  T('accroche '+s.id, !!s.accroche);
});

/* ---------- 4. Banque paléo ---------- */
T('vingt questions par site', QUIZ_PALEO.length===SITES.length*20, QUIZ_PALEO.length+'');
QUIZ_PALEO.forEach(q=>{
  T('site connu '+q.id, SITES.some(s=>s.id===q.site));
  T('4 choix '+q.id, q.choix.length===4);
  T('choix distincts '+q.id, new Set(q.choix).size===4);
  T('bonne réponse dans les choix '+q.id, q.choix.includes(q.r));
  T('explication '+q.id, !!(q.exp&&q.exp.length>10));
});
SITES.forEach(s=>T('20 questions pour '+s.id,
  QUIZ_PALEO.filter(q=>q.site===s.id).length===20));

/* ---------- 5. Orthographe ---------- */
ORTHO.forEach((o,i)=>{
  T('ortho #'+i+' a un trou', o.q.includes('___'));
  T('ortho #'+i+' 3 distracteurs', o.autres.length===3);
  T('ortho #'+i+' réponse hors distracteurs', !o.autres.includes(o.r));
  T('ortho #'+i+' explication', !!(o.exp&&o.exp.length>10));
  T('ortho #'+i+' niveau 1-3', o.niv>=1&&o.niv<=3);
});
T('énoncés d’orthographe uniques', new Set(ORTHO.map(o=>o.q)).size===ORTHO.length);

/* ---------- 5 bis. Banque Histoire ---------- */
T('banque Histoire fournie', Array.isArray(HISTOIRE)&&HISTOIRE.length>=45, HISTOIRE.length+' questions');
HISTOIRE.forEach((h,i)=>{
  T('histoire #'+i+' 3 distracteurs', h.autres.length===3);
  T('histoire #'+i+' distracteurs distincts de la réponse', !h.autres.includes(h.r));
  T('histoire #'+i+' distracteurs entre eux', new Set(h.autres).size===3);
  T('histoire #'+i+' explication', !!(h.exp&&h.exp.length>15));
  T('histoire #'+i+' niveau 1-3', h.niv>=1&&h.niv<=3);
  T('histoire #'+i+' énoncé interrogatif', /[?]\s*$/.test(h.q));
});
T('énoncés d’histoire uniques', new Set(HISTOIRE.map(h=>h.q)).size===HISTOIRE.length);
T('les trois niveaux sont représentés en histoire',
  [1,2,3].every(n=>HISTOIRE.some(h=>h.niv===n)));

/* ---------- 6. Conjugueur ---------- */
/* Formes témoins vérifiées à la main. Si le moteur dérive, ceci le voit. */
const TEMOINS=[
  ['être','present',0,'suis'],       ['être','subjonctif',3,'soyons'],
  ['avoir','present',5,'ont'],       ['avoir','subjonctif',2,'ait'],
  ['aller','futur',0,'irai'],        ['aller','present',4,'allez'],
  ['faire','present',4,'faites'],    ['faire','subjonctif',0,'fasse'],
  ['prendre','present',5,'prennent'],['prendre','imparfait',3,'prenions'],
  ['voir','imparfait',4,'voyiez'],   ['voir','futur',2,'verra'],
  ['pouvoir','subjonctif',0,'puisse'],['vouloir','present',2,'veut'],
  ['devoir','present',5,'doivent'],  ['savoir','subjonctif',2,'sache'],
  ['boire','present',3,'buvons'],    ['connaître','present',2,'connaît'],
  ['écrire','present',3,'écrivons'], ['lire','imparfait',0,'lisais'],
  ['aimer','present',3,'aimons'],    ['aimer','conditionnel',5,'aimeraient'],
  ['finir','present',4,'finissez'],  ['finir','subjonctif',3,'finissions'],
  ['aller','passecompose',0,'suis allé'], ['partir','passecompose',5,'sont partis'],
  ['aimer','passecompose',3,'avons aimé']
];
TEMOINS.forEach(([v,t,p,att])=>
  T('conjuguer '+v+'/'+t+'/'+p, conjuguer(v,t,p)===att, 'obtenu « '+conjuguer(v,t,p)+' », attendu « '+att+' »'));

/* Aucune forme vide ou dupliquée dans un même paradigme. */
verbesNiv(3).forEach(v=>{
  TEMPS.forEach(t=>{
    const f=[0,1,2,3,4,5].map(p=>conjuguer(v,t.id,p));
    T('formes non vides '+v+'/'+t.id, f.every(x=>x&&x.trim().length>0), JSON.stringify(f));
    /* Un paradigme ne peut pas être plat : au moins trois formes distinctes
       sur six, sinon une table a été mal saisie. */
    T('paradigme non plat '+v+'/'+t.id, new Set(f).size>=3, JSON.stringify(f));
  });
  T('participe passé '+v, !!participe(v));
});
T('élision de je', sujetPour(0,'ai')==='j’' && sujetPour(0,'pars')==='je ');
T('trois niveaux de verbes', verbesNiv(1).length<verbesNiv(2).length && verbesNiv(2).length<verbesNiv(3).length);

/* ---------- 7. Générateurs de maths ---------- */
let mauvais=0, sansExp=0;
for(let n=1;n<=3;n++){
  GEN_MATHS.filter(g=>g.niv<=n).forEach(g=>{
    for(let i=0;i<60;i++){
      const q=g.gen(n);
      if(!q||!q.q||q.r===undefined||q.r===null||q.r==='') mauvais++;
      else if(q.choix){
        if(q.choix.length!==4||!q.choix.includes(q.r)||new Set(q.choix).size!==4) mauvais++;
      }
      if(!q||!q.exp) sansExp++;
    }
  });
}
T('générateurs maths : QCM valides', mauvais===0, mauvais+' tirages invalides');
T('générateurs maths : explication systématique', sansExp===0, sansExp+' sans explication');

/* ---------- 8. Packs ---------- */
T('4 packs dans la Bourse', PACKS.length===4, PACKS.length+'');
['conjugaison','orthographe','maths'].forEach(id=>{
  T('pack d’entraînement '+id, PACKS.some(p=>p.id===id));
  T('pack '+id+' classé en base', (PACKS.find(p=>p.id===id)||{}).cat==='base');
});
T('pack histoire présent', PACKS.some(p=>p.id==='histoire'));
T('pack histoire classé en histoire', (PACKS.find(p=>p.id==='histoire')||{}).cat==='histoire');
/* Les questions de site ne sont plus des packs : elles servent de droit
   d'entrée à chaque coup de pioche. */
SITES.forEach(s=>T('aucun pack paleo_'+s.id+' dans la Bourse', !PACKS.some(p=>p.id==='paleo_'+s.id)));
PACKS.forEach(p=>{
  T('pack '+p.id+' : théorie fournie', !!(p.theorie&&p.theorie.length>100));
  T('pack '+p.id+' : objectif', !!p.objectif);
  T('pack '+p.id+' : icône et sous-titre', !!(p.ico&&p.sous));
  T('pack '+p.id+' : catégorie tarifée', !!BAREME[p.cat]);
});

/* ---------- 8 bis. Épingles de la carte ----------
   La carte est une image générée : impossible de vérifier une position au
   degré près. Ce qui EST vérifiable, et ce qui a déjà été raté une fois :
   qu'aucune épingle ne flotte en pleine mer, et qu'aucune n'en recouvre une
   autre. Le masque est produit par tools/pins.py depuis monde.jpg. */
const CARTE={w:1535,h:1024};
SITES.forEach(s=>{
  T('épingle '+s.id+' dans le cadre',
    s.x>28 && s.x<CARTE.w-28 && s.y>28 && s.y<CARTE.h-48, s.x+','+s.y);
});
let masque=null;
try{ masque=JSON.parse(fs.readFileSync(path.join(R,'tools','masque_terre.json'),'utf8')); }catch(e){}
T('masque terre/mer disponible', !!masque);
if(masque){
  const bits=Buffer.from(masque.bits,'hex');
  const terre=(x,y)=>{
    const cx=Math.floor(x/masque.echelle), cy=Math.floor(y/masque.echelle);
    if(cx<0||cy<0||cx>=masque.w||cy>=masque.h) return false;
    const i=cy*masque.w+cx;
    return (bits[i>>3]>>(7-(i&7)))&1 ? true : false;
  };
  SITES.forEach(s=>T('épingle '+s.id+' sur la terre ferme', terre(s.x,s.y), s.x+','+s.y));
}
/* Deux sites peuvent être trop proches pour être séparés au zoom faible :
   Bernissart et Bundenbach sont à 17 px l'un de l'autre. L'application les
   regroupe alors en une grappe. Ce qu'on exige ici, c'est que la grappe
   finisse toujours par s'ouvrir : au zoom maximal, sur l'écran le plus étroit
   envisagé, chaque paire doit dépasser le seuil de fusion. */
const facteur=CARTE_LARGEUR_MIN/CARTE_ZOOM_MIN;
T('constantes de carte cohérentes',
  CARTE_ZOOM_MIN>0 && CARTE_GROUPE>0 && CARTE_LARGEUR_MIN>=320);
let pireP='', pireD=Infinity;
for(let i=0;i<SITES.length;i++) for(let j=i+1;j<SITES.length;j++){
  const d=Math.hypot(SITES[i].x-SITES[j].x, SITES[i].y-SITES[j].y);
  T('épingles '+SITES[i].id+' et '+SITES[j].id+' non confondues', d>=8, Math.round(d)+' px');
  if(d*facteur<pireD){ pireD=d*facteur; pireP=SITES[i].id+'–'+SITES[j].id; }
}
T('toute grappe s’ouvre au zoom maximal', pireD>CARTE_GROUPE,
  pireP+' : '+Math.round(pireD)+' px écran pour un seuil de '+CARTE_GROUPE);

/* ---------- 9. Économie ---------- */
/* Règle éditoriale : l'entraînement doit toujours payer mieux que l'histoire,
   sinon l'incitation s'inverse et Louise ne fera que du quiz. */
T('l’entraînement paie mieux à la question', BAREME.base.juste>BAREME.histoire.juste,
  BAREME.base.juste+' vs '+BAREME.histoire.juste);
T('l’entraînement paie mieux à l’arrivée', BAREME.base.mission>BAREME.histoire.mission);
Object.keys(BAREME).forEach(k=>{
  const b=BAREME[k];
  T('barème '+k+' : l’aide rapporte moins mais rapporte', b.aide>0&&b.aide<b.juste);
  T('barème '+k+' : prime de mission positive', b.mission>0);
});
/* Une mission menée correctement doit financer un coup de pioche, sinon la
   boucle décourage l'entraînement. Vrai même pour la filière la moins payée. */
Object.keys(BAREME).forEach(k=>{
  const g=NB_MISSION*BAREME[k].juste+BAREME[k].mission;
  T('une mission '+k+' parfaite finance une fouille', g>=COUT_FOUILLE, g+' < '+COUT_FOUILLE);
});
/* Le solde de départ doit permettre d'ouvrir le premier site ET de fouiller. */
const moinsCher=Math.min(...SITES.map(s=>s.cout));
T('crédits de départ : premier site + au moins 3 fouilles',
  CREDITS_DEPART>=moinsCher+3*COUT_FOUILLE, CREDITS_DEPART+' pour '+(moinsCher+3*COUT_FOUILLE));
/* SITES est classé par âge décroissant, pas par prix : on vérifie donc la
   chronologie ici, et l'étalement des coûts séparément. */
const ageRef=s=>Math.max(...CREATURES.filter(c=>c.site===s.id).map(c=>c.ageMax));
T('sites classés du plus ancien au plus récent',
  SITES.every((s,i)=>i===0||ageRef(s)<=ageRef(SITES[i-1])),
  SITES.map(s=>s.id+' '+ageRef(s)).join(' → '));
T('coûts tous distincts', new Set(SITES.map(s=>s.cout)).size===SITES.length);
T('coûts étalés sur au moins un facteur 4',
  Math.max(...SITES.map(s=>s.cout))>=4*Math.min(...SITES.map(s=>s.cout)));
const bonusDe=s=>Math.max(BONUS_SITE, Math.round(s.cout*BONUS_PART));
T('le bonus de site dépasse le coût du site le moins cher', bonusDe(SITES[0])>moinsCher);
T('part de bonus comprise entre 0 et 1', BONUS_PART>0 && BONUS_PART<1, BONUS_PART+'');
/* Le plancher fait qu'un site bon marché rend plus qu'il n'a coûté à ouvrir :
   c'est voulu, cela récompense les premiers pas. Ce qui ne doit jamais arriver,
   c'est qu'ouvrir puis compléter un site rapporte de l'argent. */
SITES.forEach(s=>T('compléter '+s.id+' ne rapporte pas d’argent net',
  s.cout + 13*COUT_FOUILLE > bonusDe(s), bonusDe(s)+' rendu pour '+(s.cout+13*COUT_FOUILLE)+' dépensé'));
T('seuils documentaires croissants',
  SEUILS_DOC.length===3 && SEUILS_DOC[0]===0 && SEUILS_DOC[1]<SEUILS_DOC[2]);
/* Environ 50 coups de pioche par site : 20 questions vues 2 à 3 fois. */
const parSite=20;
T('la banque d’un site supporte une cinquantaine de fouilles',
  QUIZ_PALEO.filter(q=>q.site===SITES[0].id).length===parSite);

/* ---------- 10. Cohérence app.js / index.html ---------- */
const app=lire('app.js'), html=lire('index.html'), sw=lire('sw.js');
[/* identifiants structurants ; le contrôle automatique juste après
    attrape tout le reste */
 'fond-global','svg-monde','pins','vue-carte','vue-chantier','chantier-fond',
 'ch-retour','ch-relire','ch-nom','ch-meta','ch-jauge','ch-avance','ch-vignettes',
 'ch-cout','btn-fouiller','modal','modal-corps','tranchee','tranchee-corps',
 'intro','intro-fond','intro-accroche','intro-titre','intro-txt','intro-dots','intro-next',
 'reveal','reveal-corps','fiche','fiche-corps','fiche-fermer',
 'toast','solde','solde-nb','col-compte','col-corps','bourse-corps'
].forEach(id=>T('index.html fournit #'+id, html.includes('id="'+id+'"')));

/* Tout identifiant interrogé par app.js doit exister dans index.html.
   Vérification automatique : la liste ci-dessus fige les incontournables,
   celle-ci attrape tout ce qu'on ajouterait plus tard. */
const vus=new Set();
let m; const rx=/\$\('#([a-zA-Z0-9_-]+)'\)/g;
while((m=rx.exec(app))) vus.add(m[1]);
/* Les identifiants créés dynamiquement par app.js lui-même sont exclus. */
const dyn=new Set(['rev-flip','q-rep','q-input','q-fb','btn-indice',
  'tr-rep','tr-indice','tr-fb','tr-essais','md-vue','pins']);
[...vus].filter(id=>!dyn.has(id)).forEach(id=>
  T('app.js interroge #'+id+' : présent dans index.html', html.includes('id="'+id+'"')));

['fouille','collection','bourse'].forEach(e=>{
  T('écran '+e+' présent', html.includes('id="ecran-'+e+'"'));
  T('onglet '+e+' présent', html.includes('data-ecran="'+e+'"'));
});
T('data.js chargé avant app.js',
  html.indexOf('data.js')>0 && html.indexOf('data.js')<html.indexOf('app.js'));
T('aucun localStorage dans data.js', !src.includes('localStorage'));
T('sw enregistré', app.includes("serviceWorker") && app.includes('sw.js'));
T('sw met la carte du monde en cache', sw.includes('monde.jpg'));
CREATURES.forEach(c=>T('sw met en cache '+c.id, sw.includes(c.img)));
T('manifest référencé', html.includes('manifest.json'));
const man=JSON.parse(lire('manifest.json'));
man.icons.forEach(i=>T('icône '+i.src, existe(i.src)));

/* ---------- Rapport ---------- */
console.log('');
console.log('  RÉUSSITES ('+ok+')');
console.log('  ÉCHECS ('+echecs.length+')');
if(echecs.length){
  console.log('');
  echecs.forEach(e=>console.log('   ✗ '+e));
  process.exit(1);
}
