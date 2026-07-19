/* ================================================================
   LE GRAND ATLAS DU TEMPS PROFOND — sw.js
   Cache-first versionné. Pour publier une mise à jour : incrémenter
   VERSION. L'ancien cache est purgé à l'activation.
   ================================================================ */
const VERSION='atlas-v6';
const SHELL=[
  './', './index.html', './styles.css',
  './data.js', './app.js', './manifest.json',
  './monde.jpg', './icones/icone-192.png', './icones/icone-512.png',
];
const IMAGES=[
  './cartes/EDI-01.jpg', './cartes/EDI-02.jpg', './cartes/EDI-03.jpg', './cartes/EDI-04.jpg',
  './cartes/EDI-05.jpg', './cartes/EDI-06.jpg', './cartes/TRI-01.jpg', './cartes/TRI-02.jpg',
  './cartes/TRI-03.jpg', './cartes/TRI-04.jpg', './cartes/TRI-05.jpg', './cartes/TRI-06.jpg',
  './cartes/BURG-01.jpg', './cartes/BURG-02.jpg', './cartes/BURG-03.jpg', './cartes/BURG-04.jpg',
  './cartes/BURG-05.jpg', './cartes/BURG-06.jpg', './cartes/CEP-01.jpg', './cartes/CEP-02.jpg',
  './cartes/CEP-03.jpg', './cartes/CEP-04.jpg', './cartes/CEP-05.jpg', './cartes/CEP-06.jpg',
  './cartes/CHO-01.jpg', './cartes/CHO-02.jpg', './cartes/CHO-03.jpg', './cartes/CHO-04.jpg',
  './cartes/CHO-05.jpg', './cartes/CHO-06.jpg', './cartes/HUN-01.jpg', './cartes/HUN-02.jpg',
  './cartes/HUN-03.jpg', './cartes/HUN-04.jpg', './cartes/HUN-05.jpg', './cartes/HUN-06.jpg',
  './cartes/DEV-01.jpg', './cartes/DEV-02.jpg', './cartes/DEV-03.jpg', './cartes/DEV-04.jpg',
  './cartes/DEV-05.jpg', './cartes/DEV-06.jpg', './cartes/CAR-01.jpg', './cartes/CAR-02.jpg',
  './cartes/CAR-03.jpg', './cartes/CAR-04.jpg', './cartes/CAR-05.jpg', './cartes/CAR-06.jpg',
  './cartes/MAZ-01.jpg', './cartes/MAZ-02.jpg', './cartes/MAZ-03.jpg', './cartes/MAZ-04.jpg',
  './cartes/MAZ-05.jpg', './cartes/MAZ-06.jpg', './cartes/KAR2-01.jpg', './cartes/KAR2-02.jpg',
  './cartes/KAR2-03.jpg', './cartes/KAR2-04.jpg', './cartes/KAR2-05.jpg', './cartes/KAR2-06.jpg',
  './cartes/LUO-01.jpg', './cartes/LUO-02.jpg', './cartes/LUO-03.jpg', './cartes/LUO-04.jpg',
  './cartes/LUO-05.jpg', './cartes/LUO-06.jpg', './cartes/JUR-01.jpg', './cartes/JUR-02.jpg',
  './cartes/JUR-03.jpg', './cartes/JUR-04.jpg', './cartes/JUR-05.jpg', './cartes/JUR-06.jpg',
  './cartes/MOR-01.jpg', './cartes/MOR-02.jpg', './cartes/MOR-04.jpg', './cartes/MOR-07.jpg',
  './cartes/MOR-08.jpg', './cartes/MOR-09.jpg', './cartes/NEM-01.jpg', './cartes/NEM-02.jpg',
  './cartes/NEM-03.jpg', './cartes/NEM-04.jpg', './cartes/NEM-05.jpg', './cartes/NEM-06.jpg',
  './cartes/NWE-01.jpg', './cartes/NWE-02.jpg', './cartes/NWE-03.jpg', './cartes/NWE-04.jpg',
  './cartes/NWE-05.jpg', './cartes/NWE-06.jpg', './cartes/YIX-01.jpg', './cartes/YIX-02.jpg',
  './cartes/YIX-03.jpg', './cartes/YIX-04.jpg', './cartes/YIX-05.jpg', './cartes/YIX-06.jpg',
  './cartes/YIX-07.jpg', './cartes/YIX-08.jpg', './cartes/HC-01.jpg', './cartes/HC-02.jpg',
  './cartes/HC-03.jpg', './cartes/HC-04.jpg', './cartes/HC-05.jpg', './cartes/HC-06.jpg',
  './cartes/WHA-01.jpg', './cartes/WHA-02.jpg', './cartes/WHA-03.jpg', './cartes/WHA-04.jpg',
  './cartes/WHA-05.jpg', './cartes/WHA-06.jpg', './sites/EDI.jpg', './sites/TRI.jpg',
  './sites/BURG.jpg', './sites/CEP.jpg', './sites/CHO.jpg', './sites/HUN.jpg',
  './sites/DEV.jpg', './sites/CAR.jpg', './sites/MAZ.jpg', './sites/KAR2.jpg',
  './sites/LUO.jpg', './sites/JUR.jpg', './sites/MOR.jpg', './sites/NEM.jpg',
  './sites/NWE.jpg', './sites/YIX.jpg', './sites/HC.jpg', './sites/WHA.jpg',
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
