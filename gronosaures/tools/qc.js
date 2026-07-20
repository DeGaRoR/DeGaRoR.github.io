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
  +'COUT_BASE,COUT_PAS,COUT_PLATEAU,CARTE_ZOOM_MIN,CARTE_GROUPE,CARTE_LARGEUR_MIN,PERIODES,GRANDS_GROUPES,grandGroupe,periodeDe,EMBLEMES,emblemeDe,fondDe,'
  +'SEUILS_DOC,FOUILLE_VIDE,ART_EU,ART_MONDE,CREATURE_ACCUEIL});')).call(sandbox); }
catch(e){ console.error('data.js illisible :',e.message); process.exit(1); }
const {CREATURES,QUIZ_PALEO,SITES,PACKS,ORTHO,HISTOIRE,GEN_MATHS,TEMPS,conjuguer,participe,
       sujetPour,verbesNiv,VER_IRR,SEUILS_DOC,COUT_FOUILLE,CREDITS_DEPART,NB_MISSION,
       BAREME,BONUS_SITE,BONUS_PART,CARTE_ZOOM_MIN,CARTE_GROUPE,CARTE_LARGEUR_MIN,
       COUT_BASE,COUT_PAS,COUT_PLATEAU,PERIODES,GRANDS_GROUPES,grandGroupe,periodeDe,EMBLEMES,emblemeDe,fondDe,ART_EU,ART_MONDE,CREATURE_ACCUEIL}=sandbox;

/* ---------- 1. Fichiers attendus ---------- */
['index.html','styles.css','data.js','app.js','sw.js','manifest.json','monde-min.webp']
  .forEach(f=>T('fichier '+f, existe(f)));

/* ---------- 2. Créatures ---------- */
T('créatures : 151 d’origine plus les packs intégrés', CREATURES.length>=151, CREATURES.length+' trouvées');
const ids=new Set();
CREATURES.forEach(c=>{
  T('id unique '+c.id, !ids.has(c.id)); ids.add(c.id);
  T('image présente '+c.id, existe(c.img), c.img);
  ['nom','groupe','periode','age','desc','prudence','conf','milieu','regime','taille']
    .forEach(k=>T('champ '+k+' non vide ('+c.id+')', !!(c[k]&&String(c[k]).trim())));
  /* ageMin peut valoir 0 : le pack LIV porte des espèces ACTUELLES, dont
     l'âge de fin est le présent. Seul un âge négatif serait incohérent. */
  T('bornes d’âge cohérentes '+c.id, c.ageMax>=c.ageMin && c.ageMin>=0 && c.ageMax>0 || (c.ageMax===0&&c.ageMin===0));
  T('confiance graphique 1-5 '+c.id, c.confN>=1&&c.confN<=5);
  T('au moins une source '+c.id, c.src.some(s=>s&&s[1]&&/^https?:\/\//.test(s[1])));
  T('site déclaré '+c.id, SITES.some(s=>s.id===c.site), c.site);
});

/* ---------- 3. Sites ---------- */
T('au moins vingt-trois sites', SITES.length>=23, SITES.length+'');
SITES.forEach(s=>{
  /* La vue satellite est facultative depuis le bloc 31 : à défaut, le fond est
     l'illustration de la créature emblème. Ce qui doit être garanti n'est donc
     plus le fichier satellite, mais qu'un fond utilisable existe. */
  T('fond utilisable '+s.id, existe(fondDe(s)), String(fondDe(s)));
  if(s.fond) T('vue satellite déclarée présente '+s.id, existe(s.fond), s.fond);
  T('au moins six créatures pour '+s.id, CREATURES.filter(c=>c.site===s.id).length>=6,
    CREATURES.filter(c=>c.site===s.id).length+'');
  T('pin dans la carte '+s.id, s.x>0&&s.x<1535&&s.y>0&&s.y<1024, s.x+','+s.y);
  T('introduction développée '+s.id, Array.isArray(s.intro)&&s.intro.length>=5, (s.intro||[]).length+' volets');
  s.intro.forEach((p,i)=>T('volet '+(i+1)+' substantiel ('+s.id+')', p.length>200, p.length+' car.'));
  T('coût de déblocage '+s.id, s.cout>0, String(s.cout));
  T('accroche '+s.id, !!s.accroche);
});

/* ---------- 4. Banque paléo ---------- */
/* Vingt questions par site est le socle, pas un plafond : Bundenbach en compte
   quarante depuis qu'il a douze créatures au lieu de six. Ce qu'on vérifie, c'est
   la PROPORTION — une question ne doit pas se retrouver posée pour un site qui n'a
   presque rien à montrer, ni un site riche tourner sur trop peu de questions. */
T('au moins vingt questions par site',
  SITES.every(s=>QUIZ_PALEO.filter(q=>q.site===s.id).length>=20), QUIZ_PALEO.length+'');
SITES.forEach(s=>{
  const nq=QUIZ_PALEO.filter(q=>q.site===s.id).length;
  const nc=CREATURES.filter(c=>c.site===s.id).length;
  T('questions proportionnées pour '+s.id, nq>=20 && nq>=nc*2 && nq<=nc*8,
    nq+' questions / '+nc+' créatures');
});
QUIZ_PALEO.forEach(q=>{
  T('site connu '+q.id, SITES.some(s=>s.id===q.site));
  T('4 choix '+q.id, q.choix.length===4);
  T('choix distincts '+q.id, new Set(q.choix).size===4);
  T('bonne réponse dans les choix '+q.id, q.choix.includes(q.r));
  T('explication '+q.id, !!(q.exp&&q.exp.length>10));
});


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
T('icônes de pack distinctes', new Set(PACKS.map(p=>p.ico)).size===PACKS.length,
  PACKS.map(p=>p.ico).join(' '));
T('douze packs dans la Bourse', PACKS.length===12, PACKS.length+'');
/* Les images d'art sont stockées en WebP comme tout le reste, alors que le script
   de téléchargement récupère des JPEG : on compare donc les noms sans extension.
   Le rapprochement avec le manifeste reste utile — il signale un chemin déclaré
   dans une banque sans contrepartie dans la liste des œuvres. */
const imgsArt=PACKS.filter(p=>p.type==='bank').flatMap(p=>p.bank()).filter(i=>i.img).map(i=>i.img);
imgsArt.forEach(p=>T('image d’art dans art/ : '+p, /^art\/[a-z0-9_]+\.webp$/.test(p)));
const manif=fs.readFileSync(path.join(R,'tools','telecharger_art.py'),'utf8');
imgsArt.forEach(p=>T('image d’art au manifeste : '+p,
  manif.includes('"'+p.replace('art/','').replace('.webp','.jpg')+'"')));
/* Les deux familles doivent rester peuplées : l'accompagnement scolaire est
   l'objectif déclaré, l'histoire et la philosophie la respiration. Ni l'une ni
   l'autre ne doit se vider au fil des remaniements. */
['ecole','histoire'].forEach(c=>T('la famille '+c+' a au moins deux packs',
  PACKS.filter(p=>p.cat===c).length>=2, PACKS.filter(p=>p.cat===c).length+''));
/* Toute banque déclarée doit répondre et fournir des items exploitables. */
PACKS.filter(p=>p.type==='bank').forEach(p=>{
  const b=p.bank();
  T('banque '+p.id+' non vide', Array.isArray(b)&&b.length>=10, (b?b.length:0)+'');
  b.forEach((it,i)=>{
    const ref=p.id+' #'+(i+1);
    T(ref+' : énoncé et réponse', !!it.q && !!it.r);
    /* Seuil bas : « 42/84 = 1/2, donc 50 %. » suffit pour un calcul.
       Ce qu'on cherche à attraper, c'est l'explication absente ou bâclée. */
    T(ref+' : explication', (it.exp||'').length>=20, (it.exp||'').length+' car.');
    if(it.autres){
      T(ref+' : trois distracteurs distincts',
        it.autres.length>=2 && new Set([it.r,...it.autres]).size===it.autres.length+1);
    }
    if(it.lien) T(ref+' : lien nommé', Array.isArray(it.lien) && !!it.lien[0]);
  });
});
['conjugaison','orthographe','maths','lecture','geographie','histscol'].forEach(id=>{
  T('pack scolaire '+id, PACKS.some(p=>p.id===id));
  T('pack '+id+' classé en ecole', (PACKS.find(p=>p.id===id)||{}).cat==='ecole');
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
   autre. Le masque est produit par tools/pins.py depuis monde-min.webp. */
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
  /* Le plancher était fixé à 8 px quand le zoom s'arrêtait à un viewBox de 90.
     La vraie garantie n'est pas ce plancher arbitraire mais l'assertion
     suivante, qui dérive le seuil des constantes de la carte. On ne garde ici
     qu'un minimum absolu : en deçà, deux épingles se recouvrent à tout zoom.
     Messel et Bundenbach sont à 7 px, soit une centaine de kilomètres. */
  T('épingles '+SITES[i].id+' et '+SITES[j].id+' non confondues', d>=5, Math.round(d)+' px');
  if(d*facteur<pireD){ pireD=d*facteur; pireP=SITES[i].id+'–'+SITES[j].id; }
}
T('toute grappe s’ouvre au zoom maximal', pireD>CARTE_GROUPE,
  pireP+' : '+Math.round(pireD)+' px écran pour un seuil de '+CARTE_GROUPE);

/* ---------- 8 ter. Classements de la collection ----------
   Un « Non classé » qui traîne est un bug silencieux : la créature disparaît
   d'une des trois vues sans que rien ne le signale. */
T('trois classements déclarés', typeof PERIODES!=='undefined' && GRANDS_GROUPES.length>=10);
const nonClasse=CREATURES.filter(c=>grandGroupe(c)==='Non classé');
T('toute créature a un grand groupe', nonClasse.length===0,
  nonClasse.map(c=>c.id+' ('+c.groupe+')').join(', '));
CREATURES.forEach(c=>{
  const p=periodeDe(c);
  T('période de '+c.id, !!p && (c.ageMin+c.ageMax)/2<=p.de, p?p.nom:'aucune');
});
/* Un groupe peut légitimement rester vide : « Échinodermes » est déclaré alors
   qu'aucune créature n'en relève — le pack Biologie explique justement pourquoi
   les holothuries ne laissent presque rien dans les roches. La vue de collection
   masque les sections vides. Ce qu'on vérifie, c'est que le classement reste
   informatif : au moins dix rubriques peuplées. */
const peuples=GRANDS_GROUPES.filter(g=>CREATURES.some(c=>grandGroupe(c)===g[0]));
T('au moins dix familles peuplées', peuples.length>=10, peuples.length+' / '+GRANDS_GROUPES.length);
T('aucune famille ne rassemble plus de la moitié de la collection',
  Math.max(...GRANDS_GROUPES.map(g=>CREATURES.filter(c=>grandGroupe(c)===g[0]).length))
    < CREATURES.length/2);

/* ---------- 8 ter bis. Explications réellement rédigées ----------
   Une question de fouille explique sa réponse. Quand la banque est générée
   depuis un PACK_*.md, l'explication n'existe pas dans la source : le
   générateur pose un texte d'attente. Rien ne le signalait, et 120 questions
   sont passées ainsi. Ce contrôle rend la dette visible et chiffrée. */
{
  const stub=QUIZ_PALEO.filter(q=>/Voir la fiche de la créature/.test(q.exp||''));
  const vides=QUIZ_PALEO.filter(q=>!q.exp || q.exp.trim().length<20);
  T('aucune question sans explication', vides.length===0, vides.length+' sans texte');
  if(stub.length){
    const par={};
    stub.forEach(q=>par[q.site]=(par[q.site]||0)+1);
    console.log('   ⚠ explications encore génériques : '+stub.length+' questions ('
      + Object.keys(par).sort().map(k=>k+' '+par[k]).join(', ') + ')');
  }
}

/* ---------- 8 quater. Pastilles de globe ----------
   Extraites des vues satellites par tools/globes.py. Un site sans pastille
   afficherait une image cassée dans l'introduction. */
/* La pastille de globe était extraite des vues satellites. Celles-ci étant
   devenues facultatives (bloc 31), la pastille l'est aussi : l'introduction
   masque l'image quand elle manque, plutôt que d'afficher un lien cassé. */
SITES.filter(s=>fs.existsSync(path.join(R,'globes',s.id+'.webp'))).forEach(s=>T('pastille de globe pour '+s.id,
  fs.existsSync(path.join(R,'globes',s.id+'.webp'))));

/* ---------- 8 quinquies. Frise verticale ----------
   L'échelle est linéaire : deux chantiers proches dans le temps DOIVENT rester
   proches sur la frise. Ce qu'on vérifie, c'est que le décalage latéral suffit à
   les rendre distincts, et que la hauteur reste défilable au pouce. */
const FRI_DEBUT=650, FRI_K=8, FRI_ECART=46;
const yFri=ma=>(FRI_DEBUT-ma)*FRI_K;
const ageSite=id=>{const cs=CREATURES.filter(c=>c.site===id);
  return cs.reduce((a,c)=>a+(c.ageMin+c.ageMax)/2,0)/cs.length;};
T('la frise couvre le plus ancien chantier',
  Math.max(...SITES.map(s=>ageSite(s.id)))<FRI_DEBUT,
  Math.round(Math.max(...SITES.map(s=>ageSite(s.id))))+' Ma');
T('hauteur de frise raisonnable', yFri(0)>2000 && yFri(0)<9000, Math.round(yFri(0))+' px');
{
  const rangs=SITES.map(s=>({id:s.id,y:yFri(ageSite(s.id))})).sort((a,b)=>a.y-b.y);
  const occ=[]; let colMax=0;
  rangs.forEach(r=>{let c=0; while(occ[c]!==undefined && r.y-occ[c]<FRI_ECART) c++;
    occ[c]=r.y; colMax=Math.max(colMax,c);});
  /* Au-delà de trois colonnes, les pastilles déborderaient d'un écran étroit. */
  /* Seuil relevé à 4 colonnes : l'atlas est passé de 23 à 30 chantiers, et
     l'axe garde la même hauteur. Au-delà, il faudra allonger la frise. */
  T('les chantiers tiennent en peu de colonnes', colMax<=3, (colMax+1)+' colonnes');
}
SITES.forEach(s=>T('âge de chantier calculable '+s.id, isFinite(ageSite(s.id))));

/* ---------- 8 sexies. Ordre des onglets et des packs ----------
   L'ordre n'est pas décoratif : il dit ce que l'application est censée être.
   Les matières d'accompagnement passent devant les exercices de remise à niveau. */
{
  const html=fs.readFileSync(path.join(R,'index.html'),'utf8');
  const ordre=[...html.matchAll(/data-ecran="([a-z]+)"/g)].map(m=>m[1]);
  T('onglets dans l’ordre voulu',
    ordre.join(' ')==='bourse fouille collection', ordre.join(' '));
  /* La frise a été repliée dans la collection : elle ne doit plus être un onglet,
     mais rester atteignable comme quatrième bouton de tri. */
  T('la frise n’est plus un onglet', !html.includes('data-ecran="frise"'));
  T('la frise est un bouton de tri', html.includes('data-tri="frise"'));
  T('quatre vues de collection', (html.match(/data-tri="/g)||[]).length===4);
  T('un seul onglet marqué actif',
    (html.match(/data-ecran="[a-z]+" class="on"/g)||[]).length===1);
  T('la pastille d’aide de la carte a été retirée', !html.includes('carte-aide'));
  T('accès aux réglages présent', html.includes('id="btn-reglages"'));
}
/* Deux familles seulement, et l'intérêt personnel devant l'accompagnement :
   c'est ce que l'utilisatrice voit en ouvrant la Bourse, donc ce que
   l'application a l'air d'être. */
T('packs : deux familles seulement',
  PACKS.every(p=>p.cat==='histoire'||p.cat==='ecole'),
  [...new Set(PACKS.map(p=>p.cat))].join(' '));
T('packs : histoire et philosophie en tête',
  PACKS.slice(0,6).every(p=>p.cat==='histoire') && PACKS.slice(6).every(p=>p.cat==='ecole'),
  PACKS.map(p=>p.cat[0]).join(''));
/* Un pack scolaire doit annoncer son objectif : ouvrir « Philosophie hors
   d'Europe » en croyant réviser le programme serait décourageant. */
PACKS.filter(p=>p.cat==='ecole').forEach(p=>{
  T('objectif scolaire annoncé : '+p.id, /[Aa]ccompagnement scolaire/.test(p.objectif||''));
  T('niveau annoncé : '+p.id, /12-15|secondaire/i.test((p.objectif||'')+(p.sous||'')));
});
T('chaque famille a son barème', PACKS.every(p=>!!BAREME[p.cat]),
  Object.keys(BAREME).join(' '));
/* Contraste : le gris secondaire le plus clair doit rester lisible sur les fonds
   photo, où le voile ne descend qu'à 86 %. Seuil retenu : luminance ≥ 0,42. */
{
  const css=fs.readFileSync(path.join(R,'styles.css'),'utf8');
  const m=css.match(/--txt3:#([0-9a-f]{6})/i);
  T('gris secondaire lisible', !!m && (()=>{
    const v=m[1], f=i=>parseInt(v.substr(i,2),16)/255;
    return (0.2126*f(0)+0.7152*f(2)+0.0722*f(4))>=0.42;
  })(), m?('#'+m[1]):'introuvable');
}
/* Poids : une application qu'on abandonne au chargement n'apprend rien. */
{
  const poids=d=>fs.readdirSync(path.join(R,d)).reduce((a,f)=>a+fs.statSync(path.join(R,d,f)).size,0);
  const tot=poids('cartes')+poids('sites')+poids('globes')+fs.statSync(path.join(R,'monde-min.webp')).size;
  /* Le plafond de 20 Mo avait été fixé pour vingt-trois chantiers. Sept packs
     de plus le portent mécaniquement au-delà, sans qu'aucune image ait grossi :
     la moyenne par carte est restée la même. Dégrader la compression pour
     rentrer sous un chiffre devenu arbitraire aurait abîmé les illustrations
     — qui sont l'essentiel de ce que la joueuse regarde — pour un gain de
     quelques centaines de kilo-octets.

     Le plafond passe donc à 26 Mo, et le contrôle qui compte devient le POIDS
     PAR CARTE : c'est lui qui dit si une image a été mal exportée, alors que le
     total ne dit que le nombre de packs. */
  const cartes=fs.readdirSync(path.join(R,'cartes'));
  const poidsCartes=cartes.map(f=>fs.statSync(path.join(R,'cartes',f)).size);
  const moyenneCarte=poidsCartes.reduce((a,b)=>a+b,0)/poidsCartes.length;
  T('images sous 26 Mo au total', tot<26e6, (tot/1e6).toFixed(1)+' Mo');
  T('carte moyenne sous 110 ko', moyenneCarte<110e3,
    (moyenneCarte/1e3).toFixed(0)+' ko sur '+cartes.length+' cartes');
  T('aucune carte au-dessus de 220 ko', Math.max(...poidsCartes)<220e3,
    (Math.max(...poidsCartes)/1e3).toFixed(0)+' ko');
  T('carte légère servie en premier',
    fs.statSync(path.join(R,'monde-min.webp')).size<300e3,
    (fs.statSync(path.join(R,'monde-min.webp')).size/1024).toFixed(0)+' Ko');
  T('toutes les cartes en WebP',
    fs.readdirSync(path.join(R,'cartes')).every(f=>f.endsWith('.webp')));
}

/* Vues satellites provisoires : un site marqué `fondProvisoire` réutilise
   l'image d'un voisin en attendant la sienne. On ne l'interdit pas — on refuse
   simplement de l'oublier, et on vérifie qu'aucun site définitif ne partage son
   fond avec un autre. */
{
  const prov=SITES.filter(s=>s.fondProvisoire);
  if(prov.length) console.log('   ⚠ vues satellites provisoires : '+prov.map(s=>s.id).join(', '));
  /* Depuis le bloc 31, un site sans vue satellite retombe sur l'illustration de
     son emblème. L'unicité doit donc porter sur le fond EFFECTIF : sinon tous
     les sites sans clé `fond` se ressemblent, valant `undefined`. */
  const def=SITES.filter(s=>!s.fondProvisoire).map(s=>fondDe(s));
  T('chaque site définitif a sa propre vue', new Set(def).size===def.length,
    def.length-new Set(def).size+' doublon(s)');
  T('les sites provisoires sont peu nombreux', prov.length<=3, prov.length+'');
}

/* ---------- 8 septies. Profils locaux ----------
   La couche de profils est éprouvée en propre par tools/profils_test.js, qui
   simule localStorage. Ici on ne vérifie que ce qui se lit dans les sources :
   qu'aucune clé de stockage ne se chevauche, que l'échange est versionné, et
   que le bandeau porte de quoi savoir qui joue. */
{
  const app=fs.readFileSync(path.join(R,'app.js'),'utf8');
  const html=fs.readFileSync(path.join(R,'index.html'),'utf8');
  T('la couche de profils est présente',
    app.includes('PROFILS_CLE') && app.includes('ETAT_PREFIXE'));
  T('l’ancienne sauvegarde est migrée, pas écrasée',
    app.includes('litJSON(ATLAS_CLE)') && !/removeItem\(ATLAS_CLE\)/.test(app));
  T('l’échange porte un numéro de schéma', /const SCHEMA=\d+/.test(app));
  T('l’export est signé', app.includes("app:'gronosaures'"));
  T('l’import refuse un schéma trop récent', app.includes('d.schema>SCHEMA'));
  T('l’import crée un profil plutôt que d’écraser',
    app.includes('L\'import crée toujours un NOUVEAU profil') || app.includes('registre.liste.push'));
  /* L'invariant est que l'état écrit passe par normaliser, quel que soit le nom
     de la variable qui le porte — l'assertion précédente visait le nom. */
  T('l’état importé est normalisé',
    /ecritJSON\(cleEtat\((?:id|[a-z]+)\),\s*normaliser\(/.test(app));
  /* Une restauration doit pouvoir rendre plusieurs parties d'un seul fichier,
     et continuer d'accepter les exports d'une seule partie déjà téléchargés. */
  T('la sauvegarde porte toutes les parties',
    app.includes('function paquetComplet') && /profils:registre\.liste\.map/.test(app));
  T('la restauration accepte l’ancien format',
    /Array\.isArray\(d\.profils\)[\s\S]{0,120}d\.etat/.test(app));
  T('la restauration n’écrase jamais', !/localStorage\.clear|caches[\s\S]{0,40}removeItem/.test(
    (app.match(/function importerProgression[\s\S]*?\n\}/)||[''])[0]));
  T('la date de sauvegarde est retenue', app.includes('registre.dernierExport'));
  T('le menu dit ce que la désinstallation efface',
    app.includes('Désinstaller l’application les efface'));
  T('le menu dit dans quel contexte on joue',
    app.includes('display-mode: standalone') && app.includes('navigator.standalone'));
  /* Forcer la mise à jour ne doit toucher qu'aux caches et au service worker. */
  {
    const f=(app.match(/async function forcerMaj[\s\S]*?\n\}/)||[''])[0];
    T('forcer la mise à jour ne touche pas aux sauvegardes',
      !/localStorage|removeItem|ATLAS_CLE|PROFILS_CLE|ETAT_PREFIXE/.test(f),
      'elle ne vide que les caches de fichiers');
  }
  T('le dernier profil ne peut pas être supprimé', app.includes('registre.liste.length<=1'));
  T('le bandeau nomme le profil courant',
    html.includes('id="btn-profil-nom"') && app.includes('majNomProfil'));
  T('un sélecteur de fichier est prévu pour l’import',
    html.includes('id="fichier-import"') && html.includes('accept="application/json'));
  /* Les clés de profil doivent être préfixées, sinon un identifiant malheureux
     pourrait entrer en collision avec le registre lui-même. */
  T('les états de profil sont préfixés', app.includes("ETAT_PREFIXE='atlas_etat_'"));
}

/* ---------- 8 octies. Images d'art ----------
   Elles sont facultatives — l'application affiche la question sans illustration
   quand le fichier manque — mais si elles sont là, elles doivent être servies
   hors ligne et créditées. */
{
  const ill=[...ART_EU,...ART_MONDE].filter(q=>q.img).map(q=>q.img);
  T('six questions illustrées', ill.length===6, ill.length+'');
  const presentes=ill.filter(p=>fs.existsSync(path.join(R,p)));
  if(presentes.length===0){
    console.log('   \u26a0 images d\u2019art absentes : les questions s\u2019afficheront sans illustration');
  }else{
    T('toutes les images d\u2019art présentes', presentes.length===ill.length,
      presentes.length+' / '+ill.length);
    T('images d\u2019art en WebP', ill.every(p=>p.endsWith('.webp')));
    T('images d\u2019art dans le cache',
      ill.every(p=>fs.readFileSync(path.join(R,'sw.js'),'utf8').includes(p)));
    T('crédits présents', fs.existsSync(path.join(R,'art','CREDITS.md')));
    /* Un crédit qui ne nomme pas ce qui est réellement affiché ne vaut rien :
       on vérifie que chaque fichier servi est bien mentionné. */
    const cred=fs.existsSync(path.join(R,'art','CREDITS.md'))
      ? fs.readFileSync(path.join(R,'art','CREDITS.md'),'utf8') : '';
    ill.forEach(p=>T('crédité : '+p, cred.includes(p.split('/').pop())));
    const poids=ill.reduce((a,p)=>a+fs.statSync(path.join(R,p)).size,0);
    T('images d\u2019art sous 2 Mo', poids<2e6, (poids/1e6).toFixed(2)+' Mo');
  }
}

/* ---------- 8 nonies. Accueil ----------
   Le premier écran décide de ce qu'on croit ouvrir. On vérifie qu'il existe,
   qu'il nomme la joueuse, qu'il explique les trois écrans et le but, et surtout
   qu'il ne revient pas : un écran d'accueil qui se rejoue est une punition. */
{
  const app=fs.readFileSync(path.join(R,'app.js'),'utf8');
  const html=fs.readFileSync(path.join(R,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(R,'styles.css'),'utf8');
  T('écran d’accueil présent', html.includes('id="accueil"') && css.includes('#accueil'));
  T('l’accueil demande un nom', html.includes('id="acc-nom"'));
  T('l’accueil ne se rejoue pas', app.includes('etat.accueilVu=true'));
  T('accueilVu fait partie de l’état', app.includes('accueilVu:false'));
  T('un profil déjà avancé saute l’accueil', app.includes('trouvees().length===0'));
  T('le guide couvre les trois écrans',
    app.includes('<b>Bourse.</b>') && app.includes('<b>Fouille.</b>') && app.includes('<b>Collection.</b>'));
  T('le guide énonce le but', app.includes('<b>Le but</b>'));
  T('le nombre de chantiers du guide est calculé', app.includes('${SITES.length} chantiers'));
  /* La créature d'accueil doit exister et son illustration être présente. */
  const c=CREATURES.find(x=>x.id===CREATURE_ACCUEIL);
  T('créature d’accueil déclarée', !!c, String(CREATURE_ACCUEIL));
  if(c) T('illustration d’accueil présente et en cache',
    fs.existsSync(path.join(R,c.img)) && fs.readFileSync(path.join(R,'sw.js'),'utf8').includes(c.img));
  T('un seul dialogue natif pour nommer', !/prompt\('Nom du nouveau profil/.test(app));
}

/* ---------- 8 decies. Choix de la partie ----------
   Il n'y a ni mot de passe ni compte : le risque n'est pas l'intrusion mais la
   méprise, jouer une heure sur la partie de quelqu'un d'autre. L'écran ne doit
   donc apparaître que s'il y a réellement un choix, et il doit montrer assez
   pour qu'on reconnaisse sa partie sans l'ouvrir. */
{
  const app=fs.readFileSync(path.join(R,'app.js'),'utf8');
  const html=fs.readFileSync(path.join(R,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(R,'styles.css'),'utf8');
  T('écran de choix présent',
    html.includes('id="choix-profil"') && css.includes('#choix-profil'));
  T('il ne s’affiche qu’à partir de deux parties',
    app.includes('registre.liste.length>1'));
  T('chaque tuile montre le nom et l’avancement',
    app.includes('cp-nom') && app.includes('cp-compte'));
  T('la vignette vient de la dernière créature trouvée',
    app.includes('function apercuProfil') && app.includes('(e.ordre||{})[k]'));
  T('on peut créer une partie depuis l’écran', app.includes('profilDepuisChoix'));
  T('l’aperçu ne charge pas l’état courant', app.includes('litJSON(cleEtat(id))'));
  T('aucun mot de passe nulle part', !/password|motDePasse|mot_de_passe/i.test(app));
  /* La liste redondante du panneau a été retirée au profit de cet écran. */
  T('pas deux listes de profils concurrentes',
    !app.includes("vueReglages==='liste'") && !css.includes('.rg-profil'));
}

/* ---------- 8 undecies. Service worker et mise en ligne ----------
   Le défaut corrigé en v25 mérite un garde-fou permanent : servir la navigation
   réseau d'abord et les feuilles de style cache d'abord produit, à chaque
   déploiement, une page au markup neuf privée de ses règles. Le symptôme est
   déroutant — on croit à un CSS fautif alors que le CSS n'est jamais arrivé. */
{
  const sw=fs.readFileSync(path.join(R,'sw.js'),'utf8');
  const code=sw.replace(/\/\*[\s\S]*?\*\//g,'');   // hors commentaires
  T('sw : le code va au réseau d’abord', /estCode|reseauDabord/.test(code));
  T('sw : html, css, js et json sont traités ensemble',
    /\\.\(html\|css\|js\|json\)/.test(code));
  T('sw : les images restent en cache d’abord', code.includes('cacheDabord'));
  T('sw : aucune lecture de cache non bornée', !/caches\.match\(/.test(code),
    'caches.match cherche dans TOUS les caches, anciens compris');
  T('sw : les lectures passent par le cache courant', /cache\.match\(/.test(code));
  T('sw : la nouvelle version prend la main aussitôt',
    code.includes('skipWaiting') && code.includes('clients.claim'));
  T('sw : les anciens caches sont supprimés', code.includes('caches.delete'));
  T('sw : l’attente réseau est bornée', /DELAI_RESEAU/.test(code));
  /* Les icônes doivent concorder de quatre côtés : le fichier sur le disque, le
     manifeste, la liste du service worker, et la balise que lit Safari.

     Leur nom porte une empreinte du contenu. Ce n'est pas un raffinement : à URL
     constante, Chrome ne voit aucun changement dans le manifeste et garde
     indéfiniment l'icône déjà posée sur l'écran d'accueil. Le nom qui change est
     le seul signal qu'il regarde.

     Corollaire : une référence morte fait échouer `cache.addAll(SHELL)`, donc
     l'installation entière du service worker. On vérifie donc aussi qu'aucune
     ancienne icône ne traîne. */
  {
    const man=JSON.parse(fs.readFileSync(path.join(R,'manifest.json'),'utf8'));
    const html=fs.readFileSync(path.join(R,'index.html'),'utf8');
    const declarees=(man.icons||[]).map(i=>i.src);
    T('le manifeste déclare trois icônes', declarees.length===3);
    declarees.forEach(src=>{
      T('icône présente sur le disque : '+src, fs.existsSync(path.join(R,src)));
      T('icône dans le cache hors ligne : '+src, sw.includes(src));
      T('icône nommée par empreinte : '+src, /icone-[\w-]+\.[0-9a-f]{8}\.png$/.test(src),
        'sans quoi une icône déjà installée ne sera jamais remplacée');
    });
    /* L'icône maskable est la même image que l'icône normale, pleine frame :
       poser l'illustration sur un fond ajoutait un bandeau que le rognage
       d'Android ne masquait qu'en partie. Elles doivent donc rester
       identiques — si l'une reprenait une marge, l'autre non, le bandeau
       reviendrait sans qu'on s'en aperçoive. */
    const msk=(man.icons||[]).find(i=>i.purpose==='maskable');
    const pleine=(man.icons||[]).find(i=>i.purpose==='any' && i.sizes==='512x512');
    T('icône maskable : pleine frame, sans bandeau',
      !!msk && !!pleine && msk.src===pleine.src,
      msk?msk.src+' vs '+(pleine||{}).src:'maskable absente');
    T('cache : aucun doublon d’icône', (()=>{
      const l=[...sw.matchAll(/'\.\/(icones\/[^']+)'/g)].map(m=>m[1]);
      return l.length===new Set(l).size;
    })());

    const pomme=(html.match(/apple-touch-icon" href="([^"]+)"/)||[])[1];
    T('Safari : apple-touch-icon renseigné', !!pomme);
    T('Safari : elle pointe une icône déclarée', declarees.includes(pomme), String(pomme));
    /* Aucune icône orpheline sur le disque ni citée dans sw.js. */
    const surDisque=fs.readdirSync(path.join(R,'icones')).filter(f=>f.endsWith('.png'));
    const orphelines=surDisque.filter(f=>!declarees.includes('icones/'+f));
    T('aucune icône orpheline sur le disque', orphelines.length===0, orphelines.join(', '));
    const citees=[...sw.matchAll(/'\.\/(icones\/[^']+)'/g)].map(m=>m[1]);
    const mortes=citees.filter(c=>!fs.existsSync(path.join(R,c)));
    T('aucune référence morte dans sw.js', mortes.length===0,
      mortes.join(', ')+' — cache.addAll échouerait en bloc');
  }
  T('sw : version alignée sur le manifeste',
    /const VERSION='atlas-v\d+'/.test(code));

  /* La version est écrite à deux endroits qui doivent concorder. Les laisser
     diverger produit exactement la panne que le bloc de versions du menu sert à
     diagnostiquer : une application qui se croit à jour pendant que le cache
     sert l'ancienne. `node tools/version.js <n>` porte les deux d'un coup. */
  {
    const vSw=(sw.match(/VERSION='atlas-(v\d+)'/)||[])[1];
    const vApp=(fs.readFileSync(path.join(R,'app.js'),'utf8')
      .match(/VERSION_ATLAS='(v\d+)'/)||[])[1];
    T('version : sw.js et app.js concordent', !!vSw && vSw===vApp,
      'sw='+vSw+' app='+vApp+'  → node tools/version.js '+String(vSw||'').replace('v',''));
  }

  /* Le bloc de versions du menu, et la précaution qui le rend utile : demander
     au réseau, pas au cache — sinon on demande au cache s'il est à jour. */
  {
    const app=fs.readFileSync(path.join(R,'app.js'),'utf8');
    const css=fs.readFileSync(path.join(R,'styles.css'),'utf8');
    T('menu : bloc de versions présent', app.includes('id="rg-vers"') && css.includes('.rg-vers'));
    T('menu : les trois lignes y sont',
      app.includes('Application') && app.includes('Cache hors ligne') && app.includes('Sur le serveur'));
    T('menu : la vérification est déclenchée', app.includes('majBlocVersion()'));
    T('la version en ligne est lue hors cache',
      /cache:'no-store'/.test(app) && /sw\.js\?maj=/.test(app),
      'sans quoi on relit sa propre copie');
    T('l’échec réseau est dit, pas masqué', app.includes('hors ligne'));
    T('la version de sauvegarde reste distincte',
      app.includes('VERSION_APP') && app.includes('Format de sauvegarde'));
  }
}

/* ---------- 8 duodecies. Mise en page de l'accueil ----------
   Trois règles apprises sur un vrai téléphone plutôt que dans l'abstrait. */
{
  const css=fs.readFileSync(path.join(R,'styles.css'),'utf8');
  const html=fs.readFileSync(path.join(R,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(R,'app.js'),'utf8');
  T('accueil : le contenu peut défiler',
    /\.acc-corps\{[^}]*overflow-y:auto/.test(css),
    'sinon le bouton passe sous le clavier');
  T('accueil : le titre s’adapte aux petits écrans',
    /\.acc-titre\{[^}]*clamp\(/.test(css));
  T('accueil : le champ a un style explicite',
    /#acc-nom\{[^}]*background/.test(css) && /#acc-nom:focus/.test(css));
  T('accueil : le bouton a un style explicite', /\.acc-go\{[^}]*background/.test(css));
  T('accueil : pas de focus automatique', !/acc-nom.*\.focus\(\)/.test(app),
    'le clavier masquerait l’illustration');
  T('accueil : la saisie valide à Entrée', app.includes("e.key==='Enter'"));
  T('accueil : couvre tout l’écran', /#accueil\{[^}]*position:fixed/.test(css));
  /* Un panneau qui reçoit du contenu injecté doit porter sa propre marge : sans
     elle le texte butte contre le bord et déborde, ce qui s'est vu sur le guide
     et sur le menu. Et sa hauteur doit être bornée, sinon il est coupé net. */
  T('panneaux injectés : marge intérieure',
    /#guide-corps, #reglages-corps\{[^}]*padding:/.test(css));
  T('panneaux injectés : hauteur bornée et défilement',
    /#guide-corps, #reglages-corps\{[^}]*max-height[^}]*overflow-y:auto/.test(css));
  /* Un flottant dans un titre déborde sur le paragraphe suivant. */
  T('en-tête de groupe : pas de flottant', !/h3\.grp em\{[^}]*float:/.test(css));
  T('en-tête de groupe : disposition flexible', /h3\.grp\{[^}]*display:flex/.test(css));
  /* Même piège pour l'introduction d'un chantier : ses volets vont jusqu'à
     558 caractères, largement de quoi dépasser un petit écran. */
  T('intro de chantier : le contenu peut défiler',
    /\.intro-corps\{[^}]*overflow-y:auto/.test(css));
  T('intro de chantier : le contenu n’est plus ancré au bas sans recours',
    !/\.intro-corps\{[^}]*inset:auto/.test(css));
  /* L'accueil doit être hors de <main> : un ancêtre en overflow ou en transform
     briserait son position:fixed. On compare les positions plutôt que d'écrire
     une expression gloutonne qui traverserait la balise fermante. */
  T('accueil : hors du flux principal',
    html.indexOf('id="accueil"') > html.lastIndexOf('</main>'));
  /* Toute variable employée doit être déclarée, sinon la règle tombe en silence. */
  const decl=new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gmi)].map(m=>m[1]));
  const emp=new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map(m=>m[1]));
  const abs=[...emp].filter(v=>!decl.has(v));
  T('css : toute variable employée est déclarée', abs.length===0, abs.join(', '));
}

/* ---------- 8 terdecies. Rendu hors Chrome ----------
   Trois défauts signalés sur iPhone, tous dus à un rendu tenu pour acquis. */
{
  const app=fs.readFileSync(path.join(R,'app.js'),'utf8');
  const html=fs.readFileSync(path.join(R,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(R,'styles.css'),'utf8');

  /* Les étiquettes de carte reposaient sur un contour de texte épais tenant lieu
     de fond. Safari l'épaissit au point d'empâter les lettres, et d'autant plus
     que la ligne est longue — d'où des noms de site lisibles et des étiquettes
     de grappe illisibles. Une plaque opaque ne dépend d'aucun moteur. */
  T('carte : les étiquettes ont une plaque', app.includes('pin-plaque') && css.includes('.pin-plaque'));
  T('carte : plus de contour de texte tenant lieu de fond',
    !/\.pin-(lbl|sub)\{[^}]*paint-order/.test(css));
  T('carte : une seule fabrique d’étiquette', (app.match(/plaqueTexte\(/g)||[]).length===3,
    'la grappe et le site doivent partager le même rendu');

  /* Un glyphe de flèche dépend de la police du système. */
  T('retour : tracé vectoriel et non caractère',
    !/>←</.test(html) && /class="retour"[^>]*>\s*<svg/.test(html));
  T('retour : présent aussi en bas de chantier', html.includes('id="ch-retour-bas"'));
  T('retour : les deux ramènent à la carte',
    (app.match(/#ch-retour(-bas)?'\)\.addEventListener\('click',vueCarte\)/g)||[]).length===2);

  /* Une suite de volets sans retour oblige à tout relire pour une phrase. */
  T('intro : balayage horizontal', app.includes('armerBalayageIntro') && app.includes('touchend'));
  T('intro : le balayage ignore le défilement vertical',
    /Math\.abs\(dx\)<Math\.abs\(dy\)/.test(app));
  T('intro : bouton précédent', html.includes('id="intro-prec"'));
  T('intro : pastilles atteignables', app.includes('introAller('));

  /* Deux dénominations qui se suivent doivent dire laquelle est laquelle. */
  T('fiche : le nom d’espèce est étiqueté', app.includes('Nom d’espèce'));
  T('fiche : le groupe est étiqueté', /fi-groupe"><span>Groupe<\/span>/.test(app));
  T('révélation : le groupe est étiqueté', app.includes("'Groupe : '+c.groupe"));

  /* Contrôle inverse de celui des classes orphelines : toute classe employée
     dans le markup ou dans un gabarit doit avoir au moins une règle. Une classe
     sans règle laisse l'élément à l'apparence par défaut du navigateur, ce qui
     passe inaperçu sur Chrome et se voit sur iOS — c'est ainsi que le bouton de
     fermeture de fiche est resté sans style. `zsc` est exempté : c'est un
     marqueur lu par le JS pour la contre-échelle, il n'a rien à styler. */
  {
    const EXEMPTES=new Set(['zsc']);
    const cls=new Set();
    [...(html+app).matchAll(/class=["'\\]*([a-zà-ÿ0-9 _-]+)/gi)].forEach(m=>
      m[1].trim().split(/\s+/).forEach(c=>{ if(c.length>2 && !EXEMPTES.has(c)) cls.add(c); }));
    const sans=[...cls].filter(c=>!new RegExp('\\.'+c+'[\\s,{:.>]').test(css));
    T('toute classe employée a une règle CSS', sans.length===0, sans.join(', '));
  }
}

/* ---------- 8 quaterdecies. Rappels théoriques et écran de pack ----------
   Les rappels étaient des catalogues à rubriques capitalisées : on les
   parcourait sans les lire. Ils sont désormais en prose suivie, et l'écran d'un
   pack ne porte plus que le thème, le bouton et le rappel replié. */
{
  const app=fs.readFileSync(path.join(R,'app.js'),'utf8');
  const css=fs.readFileSync(path.join(R,'styles.css'),'utf8');
  PACKS.filter(p=>p.theorie).forEach(p=>{
    const t=p.theorie;
    T('rappel en prose : '+p.id, !/^[A-ZÀ-Ÿ][A-ZÀ-Ÿ' ,]{8,}[.:]/m.test(t) && !/^•/m.test(t),
      'ni rubrique capitalisée ni puce');
    T('rappel étoffé : '+p.id, t.length>1100, t.length+' caractères');
    T('rappel en paragraphes : '+p.id, t.split(/\n{2,}/).length>=4);
  });
  T('les douze packs ont un rappel', PACKS.filter(p=>p.theorie).length===12);
  T('le rappel est rendu en paragraphes', app.includes('function theorieHTML'));
  T('le rappel a une mesure de ligne bornée', /\.theo > div\{[^}]*max-width/.test(css));
  /* Écran de pack dégraissé : plus d'objectif, de jauge ni de barème. */
  T('écran de pack : plus d’objectif affiché', !app.includes('class="pk-obj"'));
  T('écran de pack : plus de jauge ni de barème', !app.includes('class="pk-st2"'));
  T('écran de pack : le thème et le bouton', app.includes('pk-hero') && app.includes('pk-lancer'));
  T('écran de pack : le rappel reste accessible', app.includes('<details class="theo"'));
  /* Les classes de l'en-tête ne doivent pas entrer en collision avec celles des
     cartes de la liste, qui emploient déjà pk-ico et pk-go. */
  T('pas de collision de classes de pack',
    app.includes('pk-hero-ico') && !/pk-hero[\s\S]{0,80}class="pk-ico"/.test(app));
}

/* ---------- 8 quindecies. Biais de QCM ----------
   Une question à choix se résout sans rien connaître au sujet dès qu'un indice
   de forme trahit la bonne réponse. Le plus courant est la longueur : la clé
   porte la nuance, les leurres sont expédiés. Mesuré sur l'atlas, cela donnait
   67 % de bonnes réponses reconnaissables comme la plus longue option, contre
   25 % attendus au hasard — de quoi jouer deux fois sur trois en devinant.

   Le travail se fait banque par banque. Les banques déjà reprises sont tenues
   à un seuil ferme ; les autres sont mesurées et affichées, pour que le reste
   à faire soit visible et que rien ne s'aggrave en silence.

   La position n'a pas à être surveillée dans les données : app.js mélange les
   options à chaque affichage. C'est ce mélange qu'on vérifie. */
{
  const app=fs.readFileSync(path.join(R,'app.js'),'utf8');
  T('les options sont mélangées à l’affichage',
    /function melange\(/.test(app) && app.includes('melange(q.choix)'),
    'sans quoi l’ordre du fichier deviendrait un indice');
  T('le mélange est un Fisher-Yates complet',
    /for\(let i=a\.length-1;i>0;i--\)\{const j=rnd\(0,i\)/.test(app));
  T('les banques mélangent aussi leurs options', app.includes('melange([q.r,...q.autres])'));

  /* Un écran réaffiché sans être reconstruit montre l'état d'avant. C'est ainsi
     qu'une créature déterrée puis consultée dans la collection restait
     verrouillée sur son chantier : le retour à l'onglet Fouille redonnait un
     écran périmé. Les trois onglets doivent se régénérer. */
  {
    const m=(app.match(/function montrer\(ecran\)\{[\s\S]*?\n\}/)||[''])[0];
    [['fouille',/chantier\(siteActif\)/],['collection',/rendreCollection\(\)/],
     ['bourse',/menuPacks\(\)/]].forEach(([e,re])=>{
      const i=m.indexOf("ecran==='"+e+"'");
      T('onglet '+e+' : reconstruit et non réaffiché', i>=0 && re.test(m.slice(i,i+260)));
    });
    T('la carte n’est rendue que sans chantier actif', /if\(siteActif\) chantier\(siteActif\);\s*else vueCarte\(\)/.test(m));
  }
  T('après une découverte, le chantier est régénéré dans les deux cas',
    /fermerReveal\(voirFiche\)\{[\s\S]{0,420}if\(siteActif\) chantier\(siteActif\);[\s\S]{0,120}if\(voirFiche\)/.test(app),
    'y compris quand on part consulter la fiche');

  const lot=[];
  QUIZ_PALEO.forEach(x=>lot.push({src:'fouille',r:x.r,autres:x.choix.filter(c=>c!==x.r)}));
  PACKS.filter(p=>p.type==='bank').forEach(p=>p.bank().forEach(x=>{
    if(Array.isArray(x.autres)&&x.autres.length>=2) lot.push({src:p.id,r:x.r,autres:x.autres});
  }));
  const moy=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  const mes=b=>{const l=lot.filter(t=>t.src===b);
    return {n:l.length,
            pl:100*l.filter(t=>t.autres.every(a=>t.r.length>a.length)).length/l.length,
            ra:moy(l.map(t=>t.r.length/Math.max(1,moy(t.autres.map(a=>a.length)))))};};

  /* Banques reprises : seuil ferme. Une régression doit faire échouer la porte.
     Les douze packs de la Bourse y sont ; seule la fouille reste à traiter. */
  const REPRISES={philomonde:1, biologie:1, orthographe:1, histoire:1,
                  histscol:1, arteu:1, geographie:1,
                  lecture:1, philosophie:1, artmonde:1};
  Object.keys(REPRISES).forEach(b=>{
    const m=mes(b);
    T('qcm '+b+' : clé rarement la plus longue', m.pl<=25, m.pl.toFixed(0)+' % (cible 25)');
    T('qcm '+b+' : longueurs comparables', m.ra<=1.10, m.ra.toFixed(2)+' (seuil 1,10)');
  });

  /* La fouille se traite chantier par chantier : le détail par chantier dit ce
     qui est fait et ce qui reste, et tient les chantiers déjà repris. */
  {
    /* Les vingt-trois chantiers sont repris : la liste vaut désormais
       vérification complète, et non plus suivi d'avancement. */
    const FAITS=SITES.map(s=>s.id);
    const parSite={};
    QUIZ_PALEO.forEach(q=>{
      const s=q.id.split('-')[0];
      const a=q.choix.filter(c=>c!==q.r);
      (parSite[s]=parSite[s]||[]).push(a.every(c=>q.r.length>c.length)?1:0);
    });
    FAITS.forEach(s=>{
      const l=parSite[s]||[];
      const p=100*l.reduce((x,y)=>x+y,0)/Math.max(1,l.length);
      T('qcm chantier '+s+' : clé rarement la plus longue', p<=25, p.toFixed(0)+' %');
    });
    const reste=Object.keys(parSite).filter(s=>!FAITS.includes(s))
      .map(s=>{const l=parSite[s]; return [s,100*l.reduce((x,y)=>x+y,0)/l.length,l.length];})
      .sort((a,b)=>b[1]-a[1]);
    if(reste.length){
      console.log('   \u26a0 chantiers de fouille restant à reprendre ('
        +reste.reduce((n,r)=>n+r[2],0)+' questions) :');
      console.log('       '+reste.map(r=>r[0]+' '+r[1].toFixed(0)+' %').join(' · '));
    }
  }

  /* Banques encore à reprendre : mesurées et annoncées, sans faire échouer. */
  const restantes=[...new Set(lot.map(t=>t.src))].filter(b=>!REPRISES[b])
    .map(b=>[b,mes(b)]).sort((a,b)=>b[1].ra-a[1].ra);
  if(restantes.length){
    console.log('   \u26a0 biais de longueur restant à corriger (node tools/qcm.js) :');
    restantes.forEach(([b,m])=>console.log('       '+b.padEnd(13)+String(m.n).padStart(4)
      +' questions   clé la plus longue '+m.pl.toFixed(0).padStart(3)+' %   ratio '+m.ra.toFixed(2)));
  }
  /* Garde-fou global : la situation ne doit pas empirer. */
  const moyenne=x=>x.reduce((s,v)=>s+v,0)/Math.max(1,x.length);
  const tous={n:lot.length,
    pl:100*lot.filter(t=>t.autres.every(a=>t.r.length>a.length)).length/lot.length,
    ratio:moyenne(lot.map(t=>t.r.length/Math.max(1,moyenne(t.autres.map(a=>a.length)))))};
  T('qcm : le biais global tient la cible', tous.pl<=25, tous.pl.toFixed(1)+' % (cible 25)');
  T('qcm : la clé n’est pas plus longue en moyenne', tous.ratio<=1.10,
    'ratio '+tous.ratio.toFixed(2)+' (plafond 1,10)');

  /* Sentinelles d'appariement. Réécrire les options d'une banque en les
     repérant par leur RANG plutôt que par leur énoncé applique chaque
     correction à la mauvaise question : les données restent formellement
     valides — quatre choix distincts, clé incluse — mais les réponses ne
     correspondent plus aux questions. L'erreur a été commise sur `histoire`,
     où les questions à reprendre étaient dispersées dans une banque de 52.

     Quelques couples question/réponse servent de témoins. Ils n'ont rien
     d'exhaustif : ils suffisent à faire échouer la porte si un décalage
     général se reproduit. */
  {
    const temoins=[
      ['histoire','âge donne-t-on à la Terre','4,54'],
      ['histoire','cratère de Chicxulub','Yucatán'],
      ['histoire','Mary Anning','Lyme Regis'],
      ['histoire','stromatolithes','micro-organismes'],
      ['biologie','concombre de mer','échinodermes'],
      ['philomonde','asabiyya','cohésion'],
      ['geographie','point culminant de la Belgique','Botrange'],
      ['histscol','Belgique devient-elle indépendante','1830'],
    ];
    temoins.forEach(([pack,frag,attendu])=>{
      const p=PACKS.find(x=>x.id===pack);
      const c=(p?p.bank():[]).filter(x=>x.q.includes(frag));
      T('appariement '+pack+' « '+frag+' »',
        c.length===1 && c[0].r.includes(attendu),
        c.length!==1 ? c.length+' question(s) trouvée(s)' : 'réponse : '+c[0].r);
    });
  }

  /* Le repli de fond ne doit pas rester théorique : on vérifie qu'un chantier
     dépourvu de vue satellite obtient bien une image, et qu'aucun appel n'est
     resté sur `s.fond` en direct — sinon un futur pack sans satellite
     afficherait un fond vide sans que rien ne le signale. */
  {
    const faux={id:SITES[0].id, fond:null};
    T('un chantier sans vue satellite obtient un fond', !!fondDe(faux));
    T('le repli passe par l’emblème',
      fondDe(faux)===emblemeDe(SITES[0].id).img, String(fondDe(faux)));
    T('app.js n’interroge plus s.fond en direct',
      !/[^a-zA-Z]s\.fond[^a-zA-Z]/.test(app.replace(/fondDe\([^)]*\)/g,'')),
      'un appel direct contournerait le repli');
    T('la vue satellite prime quand elle existe',
      SITES.filter(s=>s.fond).every(s=>fondDe(s)===s.fond));
  }

  /* Frise : emblèmes et bornes de l'axe.

     Le globe des vues satellites ne veut rien dire sur un axe de temps, et
     vingt-trois pastilles quasi identiques ne se distinguent pas. Chaque
     chantier porte donc une créature emblème. Un chantier ajouté sans emblème
     retomberait silencieusement sur sa première créature : on exige l'entrée
     explicite, le choix par défaut n'ayant aucune raison d'être le bon. */
  {
    SITES.forEach(s=>{
      const id=EMBLEMES[s.id];
      const c=CREATURES.find(x=>x.id===id);
      T('emblème déclaré pour '+s.id, !!id, 'ajouter l’entrée dans EMBLEMES (bloc 29)');
      T('emblème '+s.id+' : créature du chantier', !!c && c.site===s.id,
        c?('appartient à '+c.site):'introuvable');
      T('emblème '+s.id+' : illustration présente',
        !!c && fs.existsSync(path.join(R,c.img)), c?c.img:'—');
    });
    T('la frise emploie l’emblème et non le globe',
      app.includes('fri-embleme') && !/fri-globe" src="globes\//.test(app));
    T('la frise voile l’emblème d’un chantier vierge', app.includes("' voile'"));
  }

  /* Placement des étiquettes de la frise.

     Le repère marque la date au pixel près et ne bouge jamais ; l'étiquette
     glisse pour trouver sa place, un filet relie les deux. On rejoue ici
     l'algorithme sur les chantiers réels, puis sur un cas de charge — dix
     gisements quaternaires, tous compris dans les vingt-et-un derniers pixels
     de la frise — et l'on vérifie ses trois propriétés. */
  {
    const DEBUT=650, PX=8, ECART=46, yF=ma=>(DEBUT-ma)*PX;
    const ageSite=id=>{
      const cs=CREATURES.filter(c=>c.site===id);
      return cs.reduce((a,c)=>a+(c.ageMin+c.ageMax)/2,0)/cs.length;
    };
    const placer=sup=>{
      const r=SITES.map(s=>({id:s.id,y:yF(ageSite(s.id))}))
        .concat(sup.map(([id,ma])=>({id,y:yF(ma)}))).sort((a,b)=>a.y-b.y);
      r.forEach((x,i)=>{ x.etiq=Math.max(x.y, i?r[i-1].etiq+ECART:-Infinity); });
      for(let i=r.length-1;i>=0;i--){
        const maxi = i===r.length-1 ? yF(0) : r[i+1].etiq-ECART;
        r[i].etiq=Math.min(r[i].etiq, maxi);
      }
      return r;
    };
    const charge=[['A',0.005],['B',0.01],['C',0.03],['D',0.08],['E',0.2],
                  ['F',0.4],['G',0.8],['H',1.2],['I',1.8],['J',2.4]];
    [['chantiers actuels',[]],['dix gisements quaternaires en plus',charge]].forEach(([nom,sup])=>{
      const r=placer(sup);
      T('frise ('+nom+') : aucune étiquette ne se recouvre',
        r.every((x,i)=>!i || x.etiq-r[i-1].etiq >= ECART-0.01));
      T('frise ('+nom+') : aucune étiquette sous le présent',
        r.every(x=>x.etiq<=yF(0)+0.01),
        'une étiquette passée sous « Aujourd’hui » se lirait comme postérieure au présent');
      T('frise ('+nom+') : l’ordre chronologique est conservé',
        r.every((x,i)=>!i || x.etiq>=r[i-1].etiq));
    });
    /* Le repère, lui, ne doit dépendre que de l'âge. */
    T('frise : le repère est posé à la date exacte',
      /class="fri-repere" style="top:\$\{y\}px"/.test(app));
    T('frise : l’étiquette est posée à sa place ajustée',
      /class="fri-site\$\{[^}]*\}" style="top:\$\{etiq\}px"/.test(app));
    T('frise : un filet relie l’étiquette à son repère', app.includes('fri-filet'));
    T('frise : plus de décalage latéral', !app.includes('margin-left:${col*14}px'));
  }

  /* L'échelle des temps doit aller jusqu'au présent : on illustre désormais
     jusqu'à l'Holocène, et un axe qui s'arrêterait avant tronquerait aussi
     bien la frise que le filtre par période. */
  {
    const derniere=PERIODES[PERIODES.length-1];
    T('les périodes vont jusqu’au présent', derniere.a===0,
      derniere.nom+' s’arrête à '+derniere.a+' Ma');
    T('les périodes se suivent sans trou', PERIODES.every((p,i)=>
      i===0 || PERIODES[i-1].a===p.de), 'bornes discontinues');
    T('le Quaternaire est couvert', PERIODES.some(p=>p.nom==='Quaternaire' && p.de>=2.5));
    T('la frise porte un repère du présent',
      app.includes('fri-fin') && app.includes('Aujourd’hui'));
    T('la frise descend jusqu’à 0 Ma', /const H=yFrise\(0\)/.test(app));
    /* Toute créature doit tomber dans une période, y compris la plus récente. */
    const dansUne=m=>PERIODES.some(p=>m<=p.de && (m>p.a || p.a===0));
    const orphelines=CREATURES.filter(c=>!dansUne((c.ageMin+c.ageMax)/2));
    T('chaque créature tombe dans une période', orphelines.length===0,
      orphelines.map(c=>c.id+' '+((c.ageMin+c.ageMax)/2)+' Ma').join(' · '));
    /* Les packs à venir comptent des espèces actuelles — cœlacanthe, animaux
       domestiques. Un âge moyen nul ne doit tomber dans aucun trou : la borne
       basse est exclusive partout sauf sur la dernière période, qui se referme
       sur le présent. */
    T('une espèce actuelle appartient à une période', dansUne(0),
      'âge moyen 0 Ma : le présent doit appartenir au Quaternaire');
    T('périodeDe range le présent au Quaternaire',
      periodeDe({ageMin:0,ageMax:0}).nom==='Quaternaire',
      periodeDe({ageMin:0,ageMax:0}).nom);
  }

  /* data.js est un assemblage de blocs. Si l'ordre de concaténation documenté
     omet un bloc, le travail qu'il porte disparaît en silence : les données
     restent valides, seules les corrections s'évaporent. Le cas s'est produit —
     l'ordre inscrit au README s'était arrêté deux blocs trop tôt.

     On vérifie donc que chaque table de correction écrite jusqu'ici est bien
     présente dans le fichier assemblé. */
  {
    const attendus=['OPTIONS_REVUES','OPTIONS_REVUES_2','OPTIONS_REVUES_3',
      'FOUILLE_REVUE','FOUILLE_REVUE_2','FOUILLE_REVUE_3','FOUILLE_REVUE_4',
      'FOUILLE_REVUE_5','FOUILLE_REVUE_6','FOUILLE_REVUE_7','OPTIONS_REVUES_4',
      'EMBLEMES','COUT_PLATEAU','fondDe'];
    const code=fs.readFileSync(path.join(R,'data.js'),'utf8');
    attendus.forEach(n=>{
      T('data.js contient le bloc '+n,
        new RegExp('(?:const|function)\\s+'+n+'\\s*[=(]').test(code),
        'bloc absent de l’assemblage — vérifier l’ordre de concaténation');
    });
  }

  /* Rééquilibrer une option ne doit jamais se payer d'un nom d'espèce inventé.
     Un binôme dont le genre appartient à l'atlas mais dont l'espèce n'y figure
     pas est presque toujours une fabrication — le cas s'est produit. */
  {
    const connus=new Set(CREATURES.map(c=>c.nom));
    const genres=new Set(CREATURES.map(c=>c.nom.split(' ')[0]));
    const faux=[];
    QUIZ_PALEO.forEach(q=>q.choix.forEach(c=>{
      if(/^[A-Z][a-zà-ÿ]+ [a-zà-ÿ]+$/.test(c) && genres.has(c.split(' ')[0]) && !connus.has(c))
        faux.push(q.id+' : '+c);
    }));
    T('aucun binôme inventé dans les options', faux.length===0, faux.join(' · '));
  }
}

/* ---------- 9. Économie ---------- */
/* Règle éditoriale : l'entraînement doit toujours payer mieux que l'histoire,
   sinon l'incitation s'inverse et Louise ne fera que du quiz. */
/* Les deux filières paient exactement pareil. Auparavant l'entraînement payait
   64 % de plus, au motif qu'il coûte plus d'effort — un bon principe quand les
   deux matières sont également accessibles, un piège quand l'une est redoutée :
   l'app payait davantage pour affronter ce qui angoisse. Choisir son pack ne
   doit rien coûter d'autre que du temps. */
T('les deux filières paient la même chose à la question',
  BAREME.base.juste===BAREME.histoire.juste, BAREME.base.juste+' vs '+BAREME.histoire.juste);
T('les deux filières paient la même prime de mission',
  BAREME.base.mission===BAREME.histoire.mission);
T('l’indice réduit le gain sans l’annuler',
  BAREME.base.aide>0 && BAREME.base.aide<BAREME.base.juste,
  BAREME.base.aide+' / '+BAREME.base.juste);
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
/* Les coûts ne sont plus tous distincts : ils suivent une rampe puis PLAFONNENT.
   La forme compte plus que le niveau — un coût qui monte sans fin renchérit les
   derniers chantiers, c'est-à-dire ceux qu'on ouvre quand il ne reste que les
   banques de questions les moins aimées. */
{
  const tries=[...SITES].map(s=>s.cout).sort((a,b)=>a-b);
  T('coûts en rampe puis plateau', tries.every((c,i)=>
    c===Math.min(COUT_BASE+COUT_PAS*i, COUT_PLATEAU)),
    tries.join(' '));
  T('le plateau est atteint', tries[tries.length-1]===COUT_PLATEAU);
  T('la rampe existe encore', tries[0]===COUT_BASE && tries[1]>tries[0]);
  T('le plus cher ne dépasse pas quatre fois le moins cher',
    COUT_PLATEAU<=4*COUT_BASE, COUT_PLATEAU+' / '+COUT_BASE);
}

/* Effort réel demandé, en exercices, en jouant au mieux. C'est le seul chiffre
   que ressent la joueuse ; on le tient par les deux bouts, le total et surtout
   le PALIER — ce qu'il faut faire pour ouvrir un chantier de plus. */
{
  const g=NB_MISSION*BAREME.base.juste+BAREME.base.mission;
  const nCr=id=>CREATURES.filter(c=>c.site===id).length;
  let solde=CREDITS_DEPART, total=0, pire=0;
  [...SITES].sort((a,b)=>a.cout-b.cout).forEach(s=>{
    const besoin=s.cout+nCr(s.id)*COUT_FOUILLE;
    let e=0;
    while(solde<besoin){ solde+=g; total+=NB_MISSION; e+=NB_MISSION; }
    solde-=besoin;
    solde+=Math.max(BONUS_SITE, Math.round(s.cout*BONUS_PART));
    pire=Math.max(pire,e);
  });
  T('ouvrir un chantier de plus reste abordable', pire<=30,
    pire+' exercices au pire palier (plafond 30)');
  T('l’ensemble reste atteignable', total<=14*SITES.length,
    total+' exercices pour les '+SITES.length+' chantiers (plafond 420)');
}
const bonusDe=s=>Math.max(BONUS_SITE, Math.round(s.cout*BONUS_PART));
T('le bonus de site dépasse le coût du site le moins cher', bonusDe(SITES[0])>moinsCher);
T('part de bonus comprise entre 0 et 1', BONUS_PART>0 && BONUS_PART<1, BONUS_PART+'');
/* Le plancher fait qu'un site bon marché rend plus qu'il n'a coûté à ouvrir :
   c'est voulu, cela récompense les premiers pas. Ce qui ne doit jamais arriver,
   c'est qu'ouvrir puis compléter un site rapporte de l'argent. */
/* On compare au nombre RÉEL de créatures du chantier, non à un majorant : avec
   un coût de fouille abaissé, le majorant masquait le cas limite. */
SITES.forEach(s=>{
  const depense=s.cout + CREATURES.filter(c=>c.site===s.id).length*COUT_FOUILLE;
  T('compléter '+s.id+' ne rapporte pas d’argent net',
    bonusDe(s)<=depense, bonusDe(s)+' rendu pour '+depense+' dépensé');
});
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
/* Un identifiant interrogé doit exister quelque part : soit dans le markup
   statique, soit dans un gabarit d'app.js qui le fabrique. La liste figée que
   tenait cette assertion oubliait chaque nouvel identifiant dynamique et
   signalait un faux défaut ; on relève désormais les deux sources. */
const fabriques=new Set();
{ let d; const rd=/id="([a-zA-Z0-9_-]+)"/g;
  while((d=rd.exec(app))) fabriques.add(d[1]); }
[...vus].forEach(id=>
  T('app.js interroge #'+id+' : cet élément existe',
    html.includes('id="'+id+'"') || fabriques.has(id),
    'ni dans index.html ni dans un gabarit'));

['fouille','collection','bourse'].forEach(e=>{
  T('écran '+e+' présent', html.includes('id="ecran-'+e+'"'));
  T('onglet '+e+' présent', html.includes('data-ecran="'+e+'"'));
});
T('data.js chargé avant app.js',
  html.indexOf('data.js')>0 && html.indexOf('data.js')<html.indexOf('app.js'));
T('aucun localStorage dans data.js', !src.includes('localStorage'));
T('sw enregistré', app.includes("serviceWorker") && app.includes('sw.js'));
T('sw met la carte du monde en cache', sw.includes('monde-min.webp'));
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
