/* ================================================================
   LE GRAND ATLAS DU TEMPS PROFOND — sw.js
   Cache-first versionné. Pour publier une mise à jour : incrémenter
   VERSION. L'ancien cache est purgé à l'activation.
   ================================================================ */
const VERSION='atlas-v24';
const SHELL=[
  './', './index.html', './styles.css',
  './data.js', './app.js', './manifest.json',
  './monde-min.webp', './icones/icone-192.png', './icones/icone-512.png',
];
const IMAGES=[
  './cartes/EDI-01.webp', './cartes/EDI-02.webp', './cartes/EDI-03.webp', './cartes/EDI-04.webp',
  './cartes/EDI-05.webp', './cartes/EDI-06.webp', './cartes/TRI-01.webp', './cartes/TRI-02.webp',
  './cartes/TRI-03.webp', './cartes/TRI-04.webp', './cartes/TRI-05.webp', './cartes/TRI-06.webp',
  './cartes/BURG-01.webp', './cartes/BURG-02.webp', './cartes/BURG-03.webp', './cartes/BURG-04.webp',
  './cartes/BURG-05.webp', './cartes/BURG-06.webp', './cartes/CEP-01.webp', './cartes/CEP-02.webp',
  './cartes/CEP-03.webp', './cartes/CEP-04.webp', './cartes/CEP-05.webp', './cartes/CEP-06.webp',
  './cartes/CHO-01.webp', './cartes/CHO-02.webp', './cartes/CHO-03.webp', './cartes/CHO-04.webp',
  './cartes/CHO-05.webp', './cartes/CHO-06.webp', './cartes/HUN-01.webp', './cartes/HUN-02.webp',
  './cartes/HUN-03.webp', './cartes/HUN-04.webp', './cartes/HUN-05.webp', './cartes/HUN-06.webp',
  './cartes/DEV-01.webp', './cartes/DEV-02.webp', './cartes/DEV-03.webp', './cartes/DEV-04.webp',
  './cartes/DEV-05.webp', './cartes/DEV-06.webp', './cartes/CAR-01.webp', './cartes/CAR-02.webp',
  './cartes/CAR-03.webp', './cartes/CAR-04.webp', './cartes/CAR-05.webp', './cartes/CAR-06.webp',
  './cartes/MAZ-01.webp', './cartes/MAZ-02.webp', './cartes/MAZ-03.webp', './cartes/MAZ-04.webp',
  './cartes/MAZ-05.webp', './cartes/MAZ-06.webp', './cartes/KAR2-01.webp', './cartes/KAR2-02.webp',
  './cartes/KAR2-03.webp', './cartes/KAR2-04.webp', './cartes/KAR2-05.webp', './cartes/KAR2-06.webp',
  './cartes/LUO-01.webp', './cartes/LUO-02.webp', './cartes/LUO-03.webp', './cartes/LUO-04.webp',
  './cartes/LUO-05.webp', './cartes/LUO-06.webp', './cartes/JUR-01.webp', './cartes/JUR-02.webp',
  './cartes/JUR-03.webp', './cartes/JUR-04.webp', './cartes/JUR-05.webp', './cartes/JUR-06.webp',
  './cartes/MOR-01.webp', './cartes/MOR-02.webp', './cartes/MOR-04.webp', './cartes/MOR-07.webp',
  './cartes/MOR-08.webp', './cartes/MOR-09.webp', './cartes/NEM-01.webp', './cartes/NEM-02.webp',
  './cartes/NEM-03.webp', './cartes/NEM-04.webp', './cartes/NEM-05.webp', './cartes/NEM-06.webp',
  './cartes/NWE-01.webp', './cartes/NWE-02.webp', './cartes/NWE-03.webp', './cartes/NWE-04.webp',
  './cartes/NWE-05.webp', './cartes/NWE-06.webp', './cartes/YIX-01.webp', './cartes/YIX-02.webp',
  './cartes/YIX-03.webp', './cartes/YIX-04.webp', './cartes/YIX-05.webp', './cartes/YIX-06.webp',
  './cartes/YIX-07.webp', './cartes/YIX-08.webp', './cartes/HC-01.webp', './cartes/HC-02.webp',
  './cartes/HC-03.webp', './cartes/HC-04.webp', './cartes/HC-05.webp', './cartes/HC-06.webp',
  './cartes/WHA-01.webp', './cartes/WHA-02.webp', './cartes/WHA-03.webp', './cartes/WHA-04.webp',
  './cartes/WHA-05.webp', './cartes/WHA-06.webp', './cartes/HUN-07.webp', './cartes/HUN-08.webp',
  './cartes/HUN-09.webp', './cartes/HUN-10.webp', './cartes/HUN-11.webp', './cartes/HUN-12.webp',
  './cartes/SAM-01.webp', './cartes/SAM-02.webp', './cartes/SAM-03.webp', './cartes/SAM-04.webp',
  './cartes/SAM-05.webp', './cartes/SAM-06.webp', './cartes/SIL-01.webp', './cartes/SIL-02.webp',
  './cartes/SIL-03.webp', './cartes/SIL-04.webp', './cartes/SIL-05.webp', './cartes/SIL-06.webp',
  './cartes/MES-01.webp', './cartes/MES-02.webp', './cartes/MES-03.webp', './cartes/MES-04.webp',
  './cartes/MES-05.webp', './cartes/MES-06.webp', './cartes/ORD-01.webp', './cartes/ORD-02.webp',
  './cartes/ORD-03.webp', './cartes/ORD-04.webp', './cartes/ORD-05.webp', './cartes/ORD-06.webp',
  './cartes/GIL-01.webp', './cartes/GIL-02.webp', './cartes/GIL-03.webp', './cartes/GIL-04.webp',
  './cartes/GIL-05.webp', './cartes/GIL-06.webp', './cartes/YIX-09.webp', './cartes/YIX-10.webp',
  './cartes/YIX-11.webp', './cartes/YIX-12.webp', './cartes/YIX-13.webp', './sites/EDI.webp',
  './sites/TRI.webp', './sites/BURG.webp', './sites/ORD.webp', './sites/CEP.webp',
  './sites/SIL.webp', './sites/CHO.webp', './sites/HUN.webp', './sites/GIL.webp',
  './sites/DEV.webp', './sites/CAR.webp', './sites/MAZ.webp', './sites/KAR2.webp',
  './sites/LUO.webp', './sites/JUR.webp', './sites/MOR.webp', './sites/NWE.webp',
  './sites/YIX.webp', './sites/NEM.webp', './sites/HC.webp', './sites/WHA.webp',
  './sites/MES.webp', './sites/SAM.webp', './globes/EDI.webp', './globes/TRI.webp',
  './globes/BURG.webp', './globes/ORD.webp', './globes/CEP.webp', './globes/SIL.webp',
  './globes/CHO.webp', './globes/HUN.webp', './globes/GIL.webp', './globes/DEV.webp',
  './globes/CAR.webp', './globes/MAZ.webp', './globes/KAR2.webp', './globes/LUO.webp',
  './globes/JUR.webp', './globes/MOR.webp', './globes/NWE.webp', './globes/YIX.webp',
  './globes/NEM.webp', './globes/HC.webp', './globes/WHA.webp', './globes/MES.webp',
  './globes/SAM.webp', './art/annonciation.webp', './art/ginevra.webp', './art/cezanne_eau.webp',
  './art/falaises_pourville.webp', './art/hiroshige_ara.webp', './art/pont_japonais.webp',
];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(VERSION);
    /* Le shell doit réussir ; les images sont mises en cache au mieux,
       une image manquante ne doit pas faire échouer l'installation. */
    await c.addAll(SHELL);
    await Promise.allSettled(IMAGES.map(u=>c.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const noms=await caches.keys();
    await Promise.all(noms.filter(n=>n!==VERSION).map(n=>caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;

  /* Navigation : réseau d'abord pour récupérer une version fraîche,
     repli sur le cache si hors ligne. */
  if(req.mode==='navigate'){
    e.respondWith((async()=>{
      try{
        const r=await fetch(req);
        const c=await caches.open(VERSION); c.put('./index.html', r.clone());
        return r;
      }catch(_){
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  /* Reste : cache d'abord. */
  e.respondWith((async()=>{
    const hit=await caches.match(req,{ignoreSearch:true});
    if(hit) return hit;
    try{
      const r=await fetch(req);
      if(r&&r.status===200&&r.type==='basic'){
        const c=await caches.open(VERSION); c.put(req,r.clone());
      }
      return r;
    }catch(_){
      return new Response('',{status:504,statusText:'hors ligne'});
    }
  })());
});
