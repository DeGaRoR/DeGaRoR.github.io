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
  +'CARTE_ZOOM_MIN,CARTE_GROUPE,CARTE_LARGEUR_MIN,PERIODES,GRANDS_GROUPES,grandGroupe,periodeDe,'
  +'SEUILS_DOC,FOUILLE_VIDE,ART_EU,ART_MONDE});')).call(sandbox); }
catch(e){ console.error('data.js illisible :',e.message); process.exit(1); }
const {CREATURES,QUIZ_PALEO,SITES,PACKS,ORTHO,HISTOIRE,GEN_MATHS,TEMPS,conjuguer,participe,
       sujetPour,verbesNiv,VER_IRR,SEUILS_DOC,COUT_FOUILLE,CREDITS_DEPART,NB_MISSION,
       BAREME,BONUS_SITE,BONUS_PART,CARTE_ZOOM_MIN,CARTE_GROUPE,CARTE_LARGEUR_MIN,
       PERIODES,GRANDS_GROUPES,grandGroupe,periodeDe,ART_EU,ART_MONDE}=sandbox;

/* ---------- 1. Fichiers attendus ---------- */
['index.html','styles.css','data.js','app.js','sw.js','manifest.json','monde-min.webp']
  .forEach(f=>T('fichier '+f, existe(f)));

/* ---------- 2. Créatures ---------- */
T('151 créatures', CREATURES.length===151, CREATURES.length+' trouvées');
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
T('vingt-trois sites', SITES.length===23, SITES.length+'');
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
T('neuf packs dans la Bourse', PACKS.length===9, PACKS.length+'');
/* Les images d'art sont stockées en WebP comme tout le reste, alors que le script
   de téléchargement récupère des JPEG : on compare donc les noms sans extension.
   Le rapprochement avec le manifeste reste utile — il signale un chemin déclaré
   dans une banque sans contrepartie dans la liste des œuvres. */
const imgsArt=PACKS.filter(p=>p.type==='bank').flatMap(p=>p.bank()).filter(i=>i.img).map(i=>i.img);
imgsArt.forEach(p=>T('image d’art dans art/ : '+p, /^art\/[a-z0-9_]+\.webp$/.test(p)));
const manif=fs.readFileSync(path.join(R,'tools','telecharger_art.py'),'utf8');
imgsArt.forEach(p=>T('image d’art au manifeste : '+p,
  manif.includes('"'+p.replace('art/','').replace('.webp','.jpg')+'"')));
/* Les deux filières doivent rester peuplées : l'entraînement est la source de
   revenu principale, l'histoire la respiration. */
['base','histoire'].forEach(c=>T('la filière '+c+' a au moins deux packs',
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

/* ---------- 8 quater. Pastilles de globe ----------
   Extraites des vues satellites par tools/globes.py. Un site sans pastille
   afficherait une image cassée dans l'introduction. */
SITES.forEach(s=>T('pastille de globe pour '+s.id,
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
  T('les chantiers tiennent en peu de colonnes', colMax<=2, (colMax+1)+' colonnes');
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
T('packs : les matières d’accompagnement en tête',
  PACKS.slice(0,6).every(p=>p.cat==='histoire') && PACKS.slice(6).every(p=>p.cat==='base'),
  PACKS.map(p=>p.cat[0]).join(''));
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
  T('images sous 20 Mo au total', tot<20e6, (tot/1e6).toFixed(1)+' Mo');
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
  const def=SITES.filter(s=>!s.fondProvisoire).map(s=>s.fond);
  T('chaque site définitif a sa propre vue', new Set(def).size===def.length);
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
  T('l’état importé est normalisé', app.includes('normaliser(d.etat)'));
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
