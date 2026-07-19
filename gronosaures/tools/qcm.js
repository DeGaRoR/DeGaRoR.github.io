#!/usr/bin/env node
/* tools/qcm.js — mesure les biais exploitables d'un questionnaire à choix.

   Une question à choix multiple peut se résoudre sans rien connaître au sujet
   dès qu'un indice de forme trahit la bonne réponse. Les trois plus courants :

     LONGUEUR   la bonne réponse est plus développée que les leurres, parce
                qu'elle porte la nuance et les réserves. C'est le biais le plus
                répandu et le plus facile à exploiter.
     ABSOLU     un leurre contenant « jamais », « toujours », « aucun » se
                reconnaît comme faux : la réalité comporte peu d'absolus.
     REPRISE    la bonne réponse reprend des mots rares de l'énoncé, ce qui la
                désigne par simple appariement.

   La POSITION n'est pas mesurée ici : app.js mélange les options à chaque
   affichage (melange, Fisher-Yates), donc l'ordre du fichier n'atteint jamais
   la joueuse. La présence de ce mélange est vérifiée par qc.js.

   Usage
     node tools/qcm.js                résumé global et par banque
     node tools/qcm.js --pires        les vingt questions les plus déséquilibrées
     node tools/qcm.js --banque <id>  le détail d'une banque
*/
const fs=require('fs'), path=require('path');
const R=path.resolve(__dirname,'..');
const s={};
new Function(fs.readFileSync(path.join(R,'data.js'),'utf8')
  +';Object.assign(this,{QUIZ_PALEO,PACKS});').call(s);

const Q=[];
s.QUIZ_PALEO.forEach(x=>Q.push({src:'fouille',id:x.id,q:x.q,r:x.r,
  autres:x.choix.filter(c=>c!==x.r)}));
s.PACKS.filter(p=>p.type==='bank').forEach(p=>p.bank().forEach(x=>{
  if(Array.isArray(x.autres)&&x.autres.length>=2)
    Q.push({src:p.id,id:p.id+'-'+x.n,q:x.q,r:x.r,autres:x.autres});
}));

const moy=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const ABSOLU=/\b(toujours|jamais|aucun|aucune|tous|toutes|uniquement|seulement|exclusivement|entièrement|totalement)\b/i;

function mesures(lot){
  const plusLongue=lot.filter(t=>t.autres.every(a=>t.r.length>a.length)).length;
  const ratio=moy(lot.map(t=>t.r.length/Math.max(1,moy(t.autres.map(a=>a.length)))));
  const abs=lot.filter(t=>t.autres.some(a=>ABSOLU.test(a)) && !ABSOLU.test(t.r)).length;
  const reprise=lot.filter(t=>{
    const e=new Set(t.q.toLowerCase().match(/[a-zà-ÿ]{6,}/g)||[]);
    const n=x=>(x.toLowerCase().match(/[a-zà-ÿ]{6,}/g)||[]).filter(m=>e.has(m)).length;
    return n(t.r)>Math.max(0,...t.autres.map(n));
  }).length;
  return {n:lot.length, plusLongue:100*plusLongue/lot.length, ratio,
          abs:100*abs/lot.length, reprise:100*reprise/lot.length};
}

const banques=[...new Set(Q.map(t=>t.src))];
const arg=process.argv[2];

if(arg==='--pires' || arg==='--banque'){
  const cible=process.argv[3];
  const lot=arg==='--banque'?Q.filter(t=>t.src===cible):Q;
  lot.map(t=>({...t, d:t.r.length-Math.max(...t.autres.map(a=>a.length))}))
     .sort((a,b)=>b.d-a.d)
     .slice(0, arg==='--banque'?200:20)
     .filter(t=>t.d>0)
     .forEach(t=>{
       console.log('\n['+t.src+' '+t.id+']  clé plus longue de '+t.d+' caractères');
       console.log('  '+t.q);
       console.log('  ✔ '+t.r);
       t.autres.forEach(a=>console.log('  · '+a));
     });
  process.exit(0);
}

const g=mesures(Q);
console.log('\n  '+Q.length+' questions à choix\n');
console.log('  la bonne réponse est la plus longue   '+g.plusLongue.toFixed(1).padStart(6)+' %   cible 25 %');
console.log('  longueur bonne / moyenne des leurres  '+g.ratio.toFixed(2).padStart(6)+'     cible 1,00');
console.log('  un leurre porte un absolu, pas la clé '+g.abs.toFixed(1).padStart(6)+' %   cible 0 %');
console.log('  la clé reprend des mots de l’énoncé   '+g.reprise.toFixed(1).padStart(6)+' %   cible bas\n');

console.log('  BANQUE            n   + longue   ratio   absolu  reprise');
banques.map(b=>[b,mesures(Q.filter(t=>t.src===b))])
  .sort((a,b)=>b[1].ratio-a[1].ratio)
  .forEach(([b,m])=>console.log('  '+b.padEnd(14)+String(m.n).padStart(4)
    +m.plusLongue.toFixed(0).padStart(8)+' %'+m.ratio.toFixed(2).padStart(8)
    +m.abs.toFixed(0).padStart(7)+' %'+m.reprise.toFixed(0).padStart(8)+' %'));
console.log('\n  node tools/qcm.js --banque <nom>   détail d’une banque');
console.log('  node tools/qcm.js --pires          les vingt pires, toutes banques\n');
