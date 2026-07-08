/* QC harness — Écurie de Légendes
 * Usage: node tools/qc.js
 * Parses index.html, extracts data, and checks:
 *  - adventure feasibility (worst case: no pulls, palier 1, buys allowed)
 *  - thresholds (puissanceMin / cible±12) reachable
 *  - robesDistinctes reachable, buy/grant card ids exist
 *  - activity types known by dispatcher; required fields per type
 *  - economy: cumulative adventure earnings vs required buys
 */
const fs=require('fs');
const base=__dirname+'/../';
const h=fs.readFileSync(base+'index.html','utf8')
  +fs.readFileSync(base+'data.js','utf8')
  +fs.readFileSync(base+'app.js','utf8')
  +fs.readFileSync(base+'styles.css','utf8');
const fail=[],warn=[],info=[];

function seg(from,to,tag){const i=h.indexOf(from);if(i<0){fail.push('extract: "'+from+'" introuvable ('+tag+')');return '';}const j=h.indexOf(to,i);return h.slice(i,j);}

/* ---- extraction ---- */
const cartesSrc=seg('const IMG=','const RARETES','cartes');
const robesSrc=seg('const ROBES=',';','robes')+';';
const baseSrc=seg('const BASE_RAR=',';','base')+';';
const hashSrc=seg('function hashStr(','\n','hash');
const palSrc=seg('function palierDe(','\n','palier');
const etapesSrc=seg('const M_ANE=','const PRIX_ACHAT','etapes');

const sandbox={console};
function run(src,names){
  const fn=new Function('SB',src+'\n;'+names.map(n=>'SB.'+n+'='+n).join(';'));
  fn(sandbox);
}
try{
  run(cartesSrc,['CARTES']);
  run(robesSrc,['ROBES']);
  run(baseSrc+hashSrc+palSrc,['BASE_RAR','hashStr','palierDe']);
  // stubs needed by etapes segment
  const stubs='const ROBES=SB.ROBES;const profilActif={niveau:5};';
  run(stubs+etapesSrc,['ETAPES_BE','ETAPES_FR','ETAPES_GB','ETAPES_DE','ETAPES_ES','ETAP_ALL']);
}catch(e){fail.push('extraction/eval: '+e.message);}

const {CARTES,ROBES,BASE_RAR,hashStr,ETAPES_BE,ETAPES_FR,ETAPES_GB,ETAPES_DE,ETAPES_ES,ETAP_ALL}=sandbox;
if(!CARTES||!ETAP_ALL){report();process.exit(1);}
const by={};CARTES.forEach(c=>by[c.id]=c);
const PRIX={commune:200,rare:450,epique:900,legendaire:2200,mythique:6000};
const statP1=(c)=>{const base=BASE_RAR[c.rarete]||8;const aff=(c.aff||[]).includes('force')?18:0;return Math.max(1,Math.min(99,base+6+aff+(hashStr(c.id+':force')%13)));};

/* ---- dispatcher types ---- */
const dispatch=[...h.matchAll(/a\.type==='(\w+)'/g)].map(m=>m[1]);
const KNOWN=new Set(dispatch);
info.push('types dispatchés: '+[...KNOWN].join(', '));

/* ---- simulate ---- */
const P5=1, TOL=12;
const PAYS=[['Belgique',ETAPES_BE],['France',ETAPES_FR],['Îles Britanniques',ETAPES_GB],['Allemagne & Pays-Bas',ETAPES_DE],['Espagne & Portugal',ETAPES_ES]];
for(const [nomPays,ETAPES] of PAYS){
let col={ane_tetu:1,cheval_charbonnier:1,cheval_laboureur:1};
let earned=200, spentNeeded=0;
info.push('===== '+nomPays+' (départ collection minimale) =====');
const order=Object.values(ETAPES).sort((a,b)=>a.numero-b.numero);
for(const et of order){
  const tag='['+et.numero+' '+et.region+']';
  if(!et.key||!et.numero)fail.push(tag+' key/numero manquant');
  if(!et.enjeu)warn.push(tag+' pas d\'enjeu');
  if(!et.province)warn.push(tag+' pas de province (carte d\'identité)');
  (et.sousEtapes||[]).forEach((se,si)=>{
    const stag=tag+' SE'+(si+1)+' "'+se.titre+'"';
    (se.activites||[]).forEach(a=>{
      if(!KNOWN.has(a.type))fail.push(stag+' type inconnu: '+a.type);
      if(a.type==='bonus'&&a.carteId&&!by[a.carteId])fail.push(stag+' carteId inexistante '+a.carteId);
      if(a.type==='ordre'&&(!a.elements||a.elements.length<2))fail.push(stag+' ordre mal formé');
      if(a.type==='carte'&&(!a.pairs||a.pairs.length<2))fail.push(stag+' carte mal formée');
      if(a.type==='ortho'&&!(a.mot&&a.indice))fail.push(stag+' ortho mal formé');
      if(a.type==='graphique'&&!(a.labels&&a.valeurs&&a.labels.length===a.valeurs.length))fail.push(stag+' graphique mal formé');
      if(a.type==='circuit'&&!(a.q&&a.choix&&a.choix.includes(a.r)))fail.push(stag+' circuit mal formé');
      if((a.type==='decision'||a.type==='quiz')&&a.choix&&!a.choix.includes(a.r))fail.push(stag+' réponse absente des choix: '+a.q);
      if(a.type==='lecture')(a.questions||[]).forEach(q=>{if(!q.choix.includes(q.r))fail.push(stag+' lecture réponse absente: '+q.q);});
      if(a.type==='calcul'){const rs=Array.isArray(a.r)?a.r:[a.r];const cs=Array.isArray(a.choix[0])?a.choix:[a.choix];rs.forEach((r,k)=>{if(!cs[k].includes(r))fail.push(stag+' calcul réponse absente: '+r);});}
      if(a.type==='compo'){
        // buy ids exist
        (a.slots||[]).forEach(s=>{const b=Array.isArray(s.buy)?s.buy:(s.buy?[s.buy]:[]);b.forEach(id=>{if(!by[id])fail.push(stag+' buy inexistant '+id);});});
        // satisfiability with col + buys (greedy on scarcity)
        const pool={...col};
        const need=[];
        (a.slots||[]).forEach(s=>{
          const cands=CARTES.filter(c=>{try{return s.m(c);}catch(e){fail.push(stag+' matcher jette: '+e.message);return false;}});
          need.push({s,cands});
        });
        need.sort((x,y)=>x.cands.length-y.cands.length);
        const usedIds={};let cost=0;
        for(const o of need){
          let pick=o.cands.find(c=>(pool[c.id]||0)>((usedIds[c.id]||0)));
          if(!pick){
            const buys=(Array.isArray(o.s.buy)?o.s.buy:(o.s.buy?[o.s.buy]:[])).map(id=>by[id]).filter(Boolean).filter(c=>o.cands.includes(c));
            if(!buys.length){fail.push(stag+' slot "'+o.s.label+'" insatisfiable (ni possédé ni achetable)');continue;}
            pick=buys.sort((x,y)=>PRIX[x.rarete]-PRIX[y.rarete])[0];
            cost+=PRIX[pick.rarete];col[pick.id]=(col[pick.id]||0)+1;pool[pick.id]=(pool[pick.id]||0)+1;
          }
          usedIds[pick.id]=(usedIds[pick.id]||0)+1;
        }
        spentNeeded+=cost;
        // thresholds vs max achievable (top-3 owned matching M_TOUS-ish per slot)
        const ownedCards=CARTES.filter(c=>(col[c.id]||0)>0);
        function bestSum(slots){
          // greedy max assignment (small n)
          const used={};let sum=0;
          for(const s of slots){
            const c=ownedCards.filter(x=>s.m(x)&&(col[x.id]||0)>(used[x.id]||0)).sort((a2,b2)=>statP1(b2)-statP1(a2))[0];
            if(!c)return -1;used[c.id]=(used[c.id]||0)+1;sum+=statP1(c);
          }
          return sum;
        }
        if(a.puissanceMin){
          const req=a.puissanceMin[P5];const mx=bestSum([...(a.slots||[])].sort((x,y)=>0));
          if(mx<0)fail.push(stag+' seuil: slots insatisfiables');
          else if(mx<req)fail.push(stag+' OBJECTIF IMPOSSIBLE (P5): max '+mx+' < requis '+req+' (palier 1, sans tirage)');
          else if(mx-req<6)warn.push(stag+' seuil serré (P5): max '+mx+' vs '+req);
        }
        if(a.royaumeUnique){
          const roys=new Set();CARTES.forEach(c=>roys.add(c.royaume));let ok=false;
          for(const R of roys){if((a.slots||[]).every(s=>{const owned=CARTES.some(c=>{try{return s.m(c)&&c.royaume===R&&(col[c.id]||0)>0;}catch(e){return false;}});const buys=(Array.isArray(s.buy)?s.buy:(s.buy?[s.buy]:[])).map(id=>by[id]).some(c=>{try{return c&&c.royaume===R&&s.m(c);}catch(e){return false;}});return owned||buys;})){ok=true;break;}}
          if(!ok)fail.push(stag+' royaumeUnique INATTEIGNABLE (aucun royaume commun aux slots)');
        }
        if(a.puissanceMax){
          const used={};let sum=0,ok=true;
          for(const s of (a.slots||[])){const c=ownedCards.filter(x=>s.m(x)&&(col[x.id]||0)>(used[x.id]||0)).sort((p,q2)=>statP1(p)-statP1(q2))[0];if(!c){ok=false;break;}used[c.id]=(used[c.id]||0)+1;sum+=statP1(c);}
          const mx=a.puissanceMax[P5];
          if(!ok)fail.push(stag+' puissanceMax slots insatisfiables');
          else if(sum>mx)fail.push(stag+' PUISSANCE MAX IMPOSSIBLE (P5): min atteignable '+sum+' > max '+mx);
        }
        if(a.cible){
          const t=a.cible[P5];
          // enumerate sums of any 3 owned (with multiplicity) matching slots M_TOUS
          const vals=ownedCards.flatMap(c=>Array(Math.min(col[c.id]||0,3)).fill(statP1(c)));
          let ok=false;
          for(let i2=0;i2<vals.length&&!ok;i2++)for(let j2=i2+1;j2<vals.length&&!ok;j2++)for(let k2=j2+1;k2<vals.length&&!ok;k2++)if(Math.abs(vals[i2]+vals[j2]+vals[k2]-t)<=TOL)ok=true;
          if(!ok)fail.push(stag+' CIBLE INATTEIGNABLE (P5): '+t+'±'+TOL);
        }
        if(a.robesDistinctes){
          const owned=CARTES.filter(c=>(col[c.id]||0)>0&&ROBES[c.id]);
          const buyable=(a.slots||[]).flatMap(s=>Array.isArray(s.buy)?s.buy:(s.buy?[s.buy]:[])).map(id=>by[id]).filter(c=>c&&ROBES[c.id]);
          const robes=new Set([...owned,...buyable].map(c=>ROBES[c.id]));
          if(robes.size<(a.slots||[]).length)fail.push(stag+' robesDistinctes: seulement '+robes.size+' robes atteignables');
        }
      }
    });
    earned+=(se.crins||0);
    if(se.cartes)se.cartes.forEach(id=>{if(!by[id])fail.push(stag+' grant inexistant '+id);else col[id]=(col[id]||0)+1;});
  });
  info.push(tag+' fini · possédées='+Object.keys(col).filter(k=>col[k]>0).length+' · gains cumulés≈'+earned+'💎 · achats requis cumulés≈'+spentNeeded+'💎');
  if(spentNeeded>earned)warn.push(tag+' BALANCE: achats requis ('+spentNeeded+') > gains aventure cumulés ('+earned+') — farming Défis nécessaire');
}
}

/* ---- LINTER DE COMPATIBILITÉ (navigateurs anciens ~2019, cf. régression v96) ---- */
(function lintCompat(){
  const JS=fs.readFileSync(base+'app.js','utf8')+'\n'+fs.readFileSync(base+'data.js','utf8');
  const CSS=fs.readFileSync(base+'styles.css','utf8');
  // retire commentaires + chaînes (garde le code des ${} des templates) pour éviter les faux positifs
  function stripJS(s){let o='',i=0;while(i<s.length){const c=s[i];
    if(c==='/'&&s[i+1]==='/'){while(i<s.length&&s[i]!=='\n')i++;continue;}
    if(c==='/'&&s[i+1]==='*'){i+=2;while(i<s.length&&!(s[i]==='*'&&s[i+1]==='/'))i++;i+=2;continue;}
    if(c==="'"||c==='"'){const q=c;i++;while(i<s.length){if(s[i]==='\\')i+=2;else if(s[i]===q){i++;break;}else i++;}o+=' ';continue;}
    if(c==='`'){i++;while(i<s.length){if(s[i]==='\\')i+=2;else if(s[i]==='$'&&s[i+1]==='{'){o+='${';i+=2;let d=1;while(i<s.length&&d>0){if(s[i]==='{')d++;else if(s[i]==='}')d--;if(d>0)o+=s[i];i++;}o+='}';}else if(s[i]==='`'){i++;break;}else i++;}o+=' ';continue;}
    o+=c;i++;}return o;}
  const J=stripJS(JS);
  const JSK=[
    [/\?\?[^=]/,'?? (nullish coalescing, Chrome 80) → (a!=null?a:b)'],
    [/\?\?=/,'??= (Chrome 85)'],
    [/\?\.(?![0-9\s])/,'?. (optional chaining, Chrome 80) → teste avec &&'],
    [/\|\|=|&&=/,'||= / &&= (logical assignment, Chrome 85)'],
    [/\.replaceAll\s*\(/,'.replaceAll (Chrome 85) → .split().join() ou regex /g'],
    [/\.at\s*\(/,'.at() (Chrome 92) → [i] / [len-1]'],
    [/\.flatMap\s*\(/,'.flatMap (Chrome 69) → .reduce((a,x)=>a.concat(x))'],
    [/[^.\w]\.flat\s*\(/,'.flat (Chrome 69)'],
    [/\bstructuredClone\s*\(/,'structuredClone (Chrome 98) → JSON.parse(JSON.stringify)'],
    [/\bObject\.hasOwn\s*\(/,'Object.hasOwn (Chrome 93)'],
    [/\.findLast(Index)?\s*\(/,'.findLast/.findLastIndex (Chrome 97)'],
    [/\.(toSorted|toReversed|toSpliced|with)\s*\(/,'méthodes immuables de tableau (Chrome 110+)'],
    [/\bPromise\.(allSettled|any)\s*\(/,'Promise.allSettled / Promise.any (Chrome 76/85)'],
    [/\b\d[\d]*_\d/,'séparateur numérique 1_000 (Chrome 75)'],
  ];
  JSK.forEach(function(p){if(p[0].test(J))fail.push('COMPAT JS: '+p[1]);});
  if(/aspect-ratio\s*:/.test(CSS)&&!/@supports\s+not\s*\(\s*aspect-ratio/.test(CSS))fail.push('COMPAT CSS: aspect-ratio sans repli @supports not(aspect-ratio) (Chrome 88)');
  if((/\bcontainer-type\s*:/.test(CSS)||/\d[\d.]*cq[whib]\b/.test(CSS))&&!/@supports\s+not\s*\(\s*container-type/.test(CSS))fail.push('COMPAT CSS: cqw/container queries sans repli @supports not(container-type) (Chrome 105)');
  if(/\bdvh\b/.test(CSS)&&!/100vh/.test(CSS))fail.push('COMPAT CSS: dvh sans repli 100vh (Chrome 108)');
  if(/(^|[^-])\binset\s*:/m.test(CSS))fail.push('COMPAT CSS: inset: (Chrome 87) → top/right/bottom/left (a déjà cassé les cartes en v88)');
  if(/color-mix\s*\(/.test(CSS))warn.push('COMPAT CSS cosmétique: color-mix (Chrome 111) — dégrade sans casser');
  if(/:is\s*\(|:where\s*\(/.test(CSS))warn.push('COMPAT CSS: :is()/:where() (Chrome 88) — règle ignorée si non supporté (cosmétique ici)');
  if(/:has\s*\(/.test(CSS))warn.push('COMPAT CSS: :has() (Chrome 105)');
  if(/backdrop-filter\s*:/.test(CSS))warn.push('COMPAT CSS cosmétique: backdrop-filter (dégrade)');
})();

/* ---- misc greps ---- */
const melCount=(h.match(/function melange\(/g)||[]).length;
if(melCount>1)warn.push('melange défini '+melCount+'× (la dernière définition MUTE le tableau) — dédupliquer');
if(!/ETAPES_BE=\{[^}]*bruxelles/.test(h))fail.push('boss BE absent');if(!/ETAPES_FR=\{[^}]*paris/.test(h))fail.push('boss FR absent');
report();
function report(){
  console.log('=== QC ÉCHECS ('+fail.length+') ===');fail.forEach(x=>console.log('❌',x));
  console.log('=== AVERTISSEMENTS ('+warn.length+') ===');warn.forEach(x=>console.log('⚠️ ',x));
  console.log('=== INFOS ===');info.forEach(x=>console.log('ℹ️ ',x));
  process.exitCode=fail.length?1:0;
}
