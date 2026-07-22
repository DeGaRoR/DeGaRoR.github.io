// Rejoue exactement la logique de atlas_sauver : union, distinct on eid,
// la plus récemment modifiée gagne, retrait des enterrées.
const key = e => e.eid || ('legacy:' + e.t);
const modt = e => e.songeT ?? e.t ?? 0;
function fusion(ancien, envoye){
  const tombes = new Set([...(ancien.carnetTombes||[]), ...(envoye.carnetTombes||[])]);
  const par = new Map();
  for(const e of [...(ancien.carnet||[]), ...(envoye.carnet||[])]){
    const k = key(e);
    if(tombes.has(k)) continue;
    const v = par.get(k);
    if(!v || modt(e) > modt(v)) par.set(k, e);
  }
  return { carnet:[...par.values()].sort((a,b)=>a.t-b.t), carnetTombes:[...tombes].sort() };
}
const T=(n,c,d)=>console.log((c?'  ✓ ':'  ✗ ')+n+(d?' — '+d:''));

// 1. deux entrées créées dans la MÊME milliseconde survivent toutes les deux
let r=fusion({carnet:[{eid:'a',t:100},{eid:'b',t:100}]},{carnet:[]});
T('deux entrées de même horodatage sont conservées', r.carnet.length===2, r.carnet.length+' entrées');

// 1bis. le comportement du plan initial, pour comparaison
const planInitial = c => [...new Map(c.map(e=>[e.t,e])).values()];
T('… là où le dédoublonnage sur t en perdait une',
  planInitial([{t:100},{t:100}]).length===1);

// 2. une note écrite sur l'appareil A et une sur B se retrouvent
r=fusion({carnet:[{eid:'a',t:1}]},{carnet:[{eid:'b',t:2}]});
T('les carnets des deux appareils se réunissent', r.carnet.length===2);

// 3. songe modifié : la version la plus récente gagne, quel que soit l'ordre
const vieux={eid:'a',t:1,songe:'ancien',songeT:10}, neuf={eid:'a',t:1,songe:'neuf',songeT:20};
T('le songe le plus récent gagne (A puis B)', fusion({carnet:[vieux]},{carnet:[neuf]}).carnet[0].songe==='neuf');
T('le songe le plus récent gagne (B puis A)', fusion({carnet:[neuf]},{carnet:[vieux]}).carnet[0].songe==='neuf');

// 4. suppression : ne réapparaît pas depuis l'autre appareil
r=fusion({carnet:[{eid:'a',t:1},{eid:'b',t:2}]},{carnet:[{eid:'a',t:1}],carnetTombes:['b']});
T('une entrée retirée ne ressuscite pas', !r.carnet.some(e=>e.eid==='b'));
T('la pierre tombale est conservée', r.carnetTombes.includes('b'));

// 5. commutativité : deux clients qui poussent aboutissent au même résultat
const A={carnet:[{eid:'a',t:1},{eid:'c',t:3}],carnetTombes:['x']};
const B={carnet:[{eid:'b',t:2}],carnetTombes:['y']};
const ab=JSON.stringify(fusion(A,B)), ba=JSON.stringify(fusion(B,A));
T('la fusion est commutative', ab===ba);

// 6. carnet ancien sans eid : pas de perte, pas de doublon
r=fusion({carnet:[{t:1},{t:2}]},{carnet:[{t:1},{t:2}]});
T('un carnet hérité sans eid ne se duplique pas', r.carnet.length===2);

// 7. l'entrée locale n'est jamais perdue si le serveur est vide
r=fusion({carnet:[]},{carnet:[{eid:'a',t:1}]});
T('première poussée : rien ne se perd', r.carnet.length===1);
