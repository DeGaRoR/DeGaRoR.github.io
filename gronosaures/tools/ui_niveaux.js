// Harnais minimal : charge data.js + app.js dans un faux DOM et éprouve le clic.
const fs=require('fs');
const el=()=>({classList:{add(){},remove(){},toggle(){},contains(){return false}},
  removeAttribute(){}, setAttribute(){}, disabled:false, set src(v){},
  style:{}, dataset:{}, set textContent(v){this._t=v}, get textContent(){return this._t||''},
  set innerHTML(v){this._h=v}, get innerHTML(){return this._h||''},
  addEventListener(){}, appendChild(){}, querySelector(){return el()},
  querySelectorAll(){return []}, focus(){}, scrollTo(){}, getBoundingClientRect(){return {width:360,height:640}}});
const store={};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},
  location:{href:''},scrollTo(){}};
global.localStorage=window.localStorage;
global.document={getElementById:()=>el(),querySelector:()=>el(),querySelectorAll:()=>[],
  createElement:()=>el(),body:el(),documentElement:el(),addEventListener(){},
  readyState:'complete'};
global.navigator={serviceWorker:{register(){return Promise.resolve()}},onLine:true};
global.fetch=()=>Promise.resolve({json:()=>Promise.resolve({})});
global.setTimeout=(f)=>{try{f()}catch(e){}; return 0};
global.requestAnimationFrame=f=>{try{f(0)}catch(e){}; return 0};
global.crypto={randomUUID:()=>'u'+Math.random().toString(36).slice(2)};
global.Image=function(){ return {set src(v){}, addEventListener(){}, onload:null, onerror:null}; };
global.Audio=function(){ return {play(){}, pause(){}, addEventListener(){}}; };
const R=require('path').join(__dirname,'..');
const src=fs.readFileSync(R+'/data.js','utf8')+'\n'+fs.readFileSync(R+'/app.js','utf8');
const ctx={};
try{ new Function(src+'\n;Object.assign(this,{PACKS,etat,SUJETS_INTRO,sujetIntro,ouvrirNiveau,lancerNiveau,enregistrerNiveaux,basculerSerie,carteSerie,introSuivant,exoSuivant,missionCourante:()=>mission,prochainExoTest:()=>prochainExo()});').call(ctx); }
catch(e){ console.log('  chargement : ÉCHEC —', e.message); process.exit(1); }
console.log('  chargement : ok');
console.log('  SUJETS_INTRO après chargement :', ctx.SUJETS_INTRO.size, 'sujets');
ctx.enregistrerNiveaux();
console.log('  après enregistrement          :', ctx.SUJETS_INTRO.size, 'sujets');
const attendu=ctx.PACKS.filter(p=>p.niveaux).reduce((a,p)=>a+p.niveaux.length,0);
console.log('  niveaux attendus              :', attendu);
console.log('  sujetIntro("niv:astro1:0")    :', ctx.sujetIntro('niv:astro1:0') ? 'trouvé' : 'INTROUVABLE');
console.log('  sujetIntro chantier existant  :', ctx.sujetIntro('LIV') ? 'trouvé' : 'INTROUVABLE');
// carteSerie doit rendre repliée par défaut
ctx.etat.seriesOuvertes=ctx.etat.seriesOuvertes||{};
const p=ctx.PACKS.find(x=>x.niveaux);
const ferme=ctx.carteSerie(p), ouvertHtml=(ctx.etat.seriesOuvertes[p.id]=true, ctx.carteSerie(p));
console.log('  repliée : contient les niveaux ?', /class="niv/.test(ferme) ? 'OUI (mauvais)' : 'non (bon)');
console.log('  dépliée : contient les niveaux ?', /class="niv/.test(ouvertHtml) ? 'oui (bon)' : 'NON (mauvais)');
console.log('  repliée : montre l\'avancement ?', /se-etat/.test(ferme) ? 'oui' : 'non');

/* ---- Porte -------------------------------------------------------------
   Ce harnais existe à cause d'un bug de zone morte temporelle : le registre
   des sujets était alimenté au démarrage depuis basculerProfil(), avant que
   sa déclaration const ne soit initialisée. L'exception était silencieuse,
   le registre restait vide, et cliquer un niveau ne faisait RIEN. Aucune
   assertion de données ne pouvait l'attraper : il fallait charger app.js. */
let ec=0;
function T(n, ok, d){ if(!ok){ ec++; console.log('   \u2717 '+n+(d?' \u2014 '+d:'')); } }
T('registre rempli à la demande', ctx.sujetIntro('niv:astro1:0')!==null);
T('tous les niveaux enregistrés', ctx.SUJETS_INTRO.size===attendu, ctx.SUJETS_INTRO.size+'/'+attendu);
T('les chantiers restent trouvables', ctx.sujetIntro('LIV')!==null);
T('série repliée par défaut', !/class="niv/.test(ferme));
T('série dépliée montre ses niveaux', /class="niv/.test(ouvertHtml));
T('avancement visible replié', /se-etat/.test(ferme));
ctx.PACKS.filter(p=>p.niveaux).forEach(p=>p.niveaux.forEach((n,i)=>
  T('sujet niv:'+p.id+':'+i, !!ctx.sujetIntro('niv:'+p.id+':'+i))));

/* ---- Liens et clics ----------------------------------------------------
   Playtest v99 : les liens n'arrivaient jamais à l'écran (enregistrerNiveaux
   ne copiait pas le champ), et tout clic sur l'écran — y compris sur la prise
   de note — faisait défiler le volet, le gestionnaire global avalant tout. */
const avecLiens=ctx.PACKS.filter(p=>p.niveaux).flatMap(p=>p.niveaux.map((n,i)=>({p,n,i})))
  .filter(x=>x.n.liens && x.n.liens.length);
T('des niveaux portent des liens dans les données', avecLiens.length>0, String(avecLiens.length));
if(avecLiens.length){
  const x=avecLiens[0];
  const su=ctx.sujetIntro('niv:'+x.p.id+':'+x.i);
  T('les liens arrivent au registre', su && su.liens && su.liens.length===x.n.liens.length,
    su ? (su.liens||[]).length+'/'+x.n.liens.length : 'sujet absent');
}
const appSrc=fs.readFileSync(R+'/app.js','utf8');
T('clic sur l écran : sélectif', /closest\('a,button,textarea/.test(appSrc));
/* Le clic sélectif ignore les boutons — donc TOUT bouton de l'écran doit avoir
   son gestionnaire propre. C'est exactement ce qui a cassé « Continuer » : le
   filtre le protégeait d'un gestionnaire qu'il n'avait pas. */
const htmlSrc=fs.readFileSync(R+'/index.html','utf8');
T('Continuer a son gestionnaire propre',
  /id="intro-next"[^>]*onclick="introSuivant\(\)"/.test(htmlSrc));
T('Précédent a son gestionnaire propre', /id="intro-prec"[^>]*onclick=/.test(htmlSrc));
T('Fermer a son gestionnaire propre', /id="intro-fermer"[^>]*onclick=/.test(htmlSrc));
T('Prendre une note a son gestionnaire propre', /id="intro-noter"[^>]*onclick=/.test(htmlSrc));
/* Les sources par carte doivent rester rattachées à leur volet. */
const con=ctx.PACKS.find(p=>p.id==='conscience1');
T('conscience : liens portés par volet',
  con.niveaux.every(n=>(n.liens||[]).every(l=>typeof l.v==='number')));
T('conscience : au moins un volet précis référencé',
  con.niveaux[0].liens.some(l=>l.v>0));
/* L'affichage filtre par volet courant. */
T('afficheIntro filtre les liens par volet', /x\.v!==undefined \? x\.v===introI : dernier/.test(appSrc));
T('balayage : sélectif', appSrc.split("touchstart")[1].slice(0,300).includes('closest'));

/* ---- Parcours complet d'un niveau -------------------------------------
   Le playtest a montré neuf volets puis PLUS RIEN : la mission fabriquée par
   lancerNiveau n'avait pas la forme attendue, exoSuivant plantait sur
   mission.vus, et l'exception partait en silence. Aucune assertion de données
   ne pouvait le voir. On rejoue donc le parcours ici, du clic à la question. */
const P=ctx.PACKS.find(x=>x.niveaux);
try{
  ctx.ouvrirNiveau(P.id, 0);
  T('leçon ouverte : sujet courant', ctx.sujetIntro('niv:'+P.id+':0')!==null);
  // parcourir tous les volets
  const n=P.niveaux[0].intro.length;
  for(let k=0;k<n;k++) ctx.introSuivant();
  const m=ctx.missionCourante();
  T('mission créée après le dernier volet', !!m, m?'ok':'aucune');
  if(m){
    ['i','gagne','justes','aide','essais','vus','ref'].forEach(c=>
      T('mission : champ '+c+' présent', m[c]!==undefined, String(m[c])));
    T('mission : vus est un tableau', Array.isArray(m.vus));
  }
  T('exoSuivant ne lève pas', (()=>{ try{ ctx.exoSuivant(); return true; }catch(e){ return 'ERR '+e.message; } })()===true);
  const q=ctx.prochainExoTest();
  T('question tirée du niveau', !!q && P.niveaux[0].bank().some(x=>x.q===q.q), q?q.q.slice(0,40):'aucune');
  console.log('  parcours : '+P.niveaux[0].intro.length+' volets → mission '+(m?'créée':'ABSENTE')+
    ' → question : '+(q?'« '+q.q.slice(0,52)+'… »':'AUCUNE'));
}catch(e){ T('parcours complet sans exception', false, e.message); }

console.log('');
console.log('  \u00C9CHECS ('+ec+')');
process.exit(ec?1:0);
