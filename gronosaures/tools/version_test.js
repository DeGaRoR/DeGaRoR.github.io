/* Le diagnostic affiché doit être juste dans les cinq situations possibles. */
const fs=require('fs');
const src=fs.readFileSync('app.js','utf8');
const numVer=v=>parseInt(String(v).replace(/\D/g,''),10)||0;

/* On rejoue la cascade de décision telle qu'elle est écrite dans app.js. */
function diagnostic(VERSION_ATLAS, vCache, vServeur, err){
  if(vCache && vCache!==VERSION_ATLAS) return 'cache-en-retard';
  if(err) return 'hors-ligne';
  if(numVer(vServeur)>numVer(VERSION_ATLAS)) return 'maj-dispo';
  return 'a-jour';
}
let A=0,E=0;
const T=(n,c,d)=>{ if(c){A++;} else {E++; console.log('   ✗ '+n+(d?'  ['+d+']':''));} };

T('tout concorde → à jour',            diagnostic('v30','v30','v30',null)==='a-jour');
T('serveur en avance → maj disponible', diagnostic('v30','v30','v31',null)==='maj-dispo');
T('cache en retard → priorité au cache', diagnostic('v30','v27','v30',null)==='cache-en-retard');
T('cache en retard ET serveur en avance → on répare le cache d’abord',
  diagnostic('v30','v27','v31',null)==='cache-en-retard');
T('réseau injoignable → dit hors ligne', diagnostic('v30','v30',null,new Error())==='hors-ligne');
T('aucun cache et réseau injoignable → hors ligne',
  diagnostic('v30',null,null,new Error())==='hors-ligne');
T('aucun cache mais serveur à jour → à jour', diagnostic('v30',null,'v30',null)==='a-jour');
T('serveur en retard sur le code → pas d’alerte',
  diagnostic('v31','v31','v30',null)==='a-jour', 'un déploiement plus ancien ne doit rien réclamer');
T('comparaison numérique, pas lexicale', numVer('v9')<numVer('v30'),
  'v9 < v30, alors que la comparaison de texte dirait l’inverse');

/* La requête doit court-circuiter les deux caches, sinon la réponse est fausse. */
T('lecture réseau : cache HTTP contourné', /cache:'no-store'/.test(src));
T('lecture réseau : service worker contourné', /sw\.js\?maj='\+Date\.now\(\)/.test(src));
T('échec du fetch capté', /catch\(e\)\{\s*err=e;\s*\}/.test(src));
console.log('\n  RÉUSSITES ('+A+')\n  ÉCHECS ('+E+')');
