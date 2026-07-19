#!/usr/bin/env node
/* tools/version.js — porter l'atlas à une version donnée, partout à la fois.

   La version est écrite à deux endroits qui doivent absolument concorder :

     sw.js    VERSION='atlas-vNN'   nomme le cache. En changer force le service
                                    worker à réinstaller, donc à servir les
                                    fichiers neufs.
     app.js   VERSION_ATLAS='vNN'   est ce que le code chargé dit de lui-même,
                                    et ce que le menu affiche.

   Les modifier séparément, à la main, produit un état où l'application se croit
   à jour pendant que le cache sert l'ancienne — précisément la panne que le
   bloc de versions du menu sert à diagnostiquer. Cet outil supprime le risque,
   et qc.js refuse un désaccord.

     node tools/version.js          affiche l'état courant
     node tools/version.js 31       porte l'ensemble à v31
     node tools/version.js +        incrémente d'une unité
*/
const fs=require('fs'), path=require('path');
const R=path.resolve(__dirname,'..');
const SW=path.join(R,'sw.js'), APP=path.join(R,'app.js');

const lire=()=>{
  const sw=fs.readFileSync(SW,'utf8').match(/VERSION='atlas-v(\d+)'/);
  const app=fs.readFileSync(APP,'utf8').match(/VERSION_ATLAS='v(\d+)'/);
  return {sw:sw?+sw[1]:null, app:app?+app[1]:null};
};

const etat=lire();
if(etat.sw===null||etat.app===null){
  console.error('  Version introuvable dans sw.js ou app.js.'); process.exit(1);
}

const arg=process.argv[2];
if(!arg){
  console.log('\n  sw.js    atlas-v'+etat.sw);
  console.log('  app.js   v'+etat.app);
  console.log(etat.sw===etat.app ? '\n  ✓ les deux concordent\n'
                                 : '\n  ✗ DÉSACCORD — node tools/version.js '+Math.max(etat.sw,etat.app)+'\n');
  process.exit(etat.sw===etat.app?0:1);
}

const cible = arg==='+' ? Math.max(etat.sw,etat.app)+1 : parseInt(arg,10);
if(!Number.isInteger(cible)||cible<1){ console.error('  Version invalide.'); process.exit(1); }

fs.writeFileSync(SW, fs.readFileSync(SW,'utf8')
  .replace(/VERSION='atlas-v\d+'/, "VERSION='atlas-v"+cible+"'"));
fs.writeFileSync(APP, fs.readFileSync(APP,'utf8')
  .replace(/VERSION_ATLAS='v\d+'/, "VERSION_ATLAS='v"+cible+"'"));

const v=lire();
console.log('  sw.js    atlas-v'+v.sw+'\n  app.js   v'+v.app
  +(v.sw===v.app?'\n  ✓ portés à v'+cible:'\n  ✗ échec'));
process.exit(v.sw===v.app?0:1);
