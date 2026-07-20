#!/usr/bin/env node
/* tools/qcm_brouillon.js — mesurer une banque AVANT de l'intégrer.

   `tools/qcm.js` mesure les banques déjà dans data.js. Celui-ci lit une banque
   encore rédigée en markdown, dans le format des fiches `PACK_XXX.md` :

       1. **Question ?** · *bonne réponse* · leurre · leurre · leurre

   Le point est d'appliquer les règles de rédaction au moment où l'on écrit,
   plutôt que de découvrir le biais une fois les questions en place — c'est
   exactement ce qui a coûté onze passes de reprise sur les 752 premières.

       node tools/qcm_brouillon.js tools/PACK_WNT.md
       node tools/qcm_brouillon.js tools/PACK_WNT.md --pires
*/
const fs=require('fs');

const fichier=process.argv[2];
if(!fichier){ console.error('  usage : node tools/qcm_brouillon.js <fichier.md>'); process.exit(1); }
const src=fs.readFileSync(fichier,'utf8');

/* On ne lit que la section des questions, pour ne pas ramasser les tableaux. */
const deb=src.indexOf('## Les vingt questions');
const fin=src.indexOf('## Mesure');
if(deb<0){ console.error('  section « ## Les vingt questions » introuvable'); process.exit(1); }
const bloc=src.slice(deb, fin<0?undefined:fin);

/* Une question peut courir sur plusieurs lignes : on recolle avant de découper. */
const items=[];
bloc.split(/\n(?=\s*\d+\.\s)/).forEach(brut=>{
  const t=brut.replace(/\s*\n\s*/g,' ').trim();
  const m=t.match(/^(\d+)\.\s*(.*)$/);
  if(!m) return;
  const parts=m[2].split('·').map(x=>x.trim()).filter(Boolean);
  if(parts.length!==5) return;
  const nu=x=>x.replace(/^\*+|\*+$/g,'').trim();
  items.push({n:+m[1], q:nu(parts[0]), r:nu(parts[1]), autres:parts.slice(2).map(nu)});
});

if(!items.length){ console.error('  aucune question reconnue'); process.exit(1); }

const moy=a=>a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);
const ABSOLU=/\b(toujours|jamais|aucun|aucune|tous|toutes|uniquement|exclusivement|entièrement|totalement)\b/i;

const plusLongue=items.filter(t=>t.autres.every(a=>t.r.length>a.length));
const ratio=moy(items.map(t=>t.r.length/Math.max(1,moy(t.autres.map(a=>a.length)))));
const absolu=items.filter(t=>!ABSOLU.test(t.r) && t.autres.some(a=>ABSOLU.test(a)));
const reprise=items.filter(t=>{
  const mots=t.q.toLowerCase().match(/[a-zà-ÿ]{5,}/g)||[];
  return mots.some(w=>t.r.toLowerCase().includes(w));
});

let ko=0;
const dire=(nom,val,cible,ok)=>{
  if(!ok) ko++;
  console.log('  '+(ok?'✓':'✗')+' '+nom.padEnd(34)+String(val).padStart(7)+'   '+cible);
};

console.log('\n  '+fichier+'  —  '+items.length+' questions\n');
dire('la clé est la plus longue', (100*plusLongue.length/items.length).toFixed(0)+' %', 'cible ≤ 25 %',
     100*plusLongue.length/items.length<=25);
dire('ratio clé / moyenne des leurres', ratio.toFixed(2), 'cible ≤ 1,10', ratio<=1.10);
dire('leurre à absolu, clé sans', (100*absolu.length/items.length).toFixed(0)+' %', 'bas', true);
dire('la clé reprend l’énoncé', (100*reprise.length/items.length).toFixed(0)+' %', 'bas', true);

/* Contrôles de structure : quatre options distinctes, énoncé interrogatif. */
const malFormees=items.filter(t=>new Set([t.r,...t.autres]).size!==4);
dire('quatre options distinctes', malFormees.length?malFormees.map(t=>t.n).join(','):'oui',
     'obligatoire', malFormees.length===0);
const sansPoint=items.filter(t=>!/\?\s*$/.test(t.q));
dire('énoncés interrogatifs', sansPoint.length?sansPoint.map(t=>t.n).join(','):'oui',
     'obligatoire', sansPoint.length===0);

if(process.argv.includes('--pires')){
  console.log('\n  questions où la clé reste la plus longue :');
  plusLongue.forEach(t=>{
    const m=Math.max(...t.autres.map(a=>a.length));
    console.log('    '+String(t.n).padStart(3)+'. clé '+t.r.length+' / leurre max '+m+'  « '+t.r+' »');
  });
}

console.log('\n  '+(ko?'À REPRENDRE ('+ko+')':'CONFORME')+'\n');
process.exit(ko?1:0);
