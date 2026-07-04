/* Service worker — Écurie de Légendes */
const VERSION='ecurie-v1';
const SHELL=["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];
const IMAGES=["./cartes/al_bouraq.jpg", "./cartes/ane_egyptien.jpg", "./cartes/ane_tetu.jpg", "./cartes/bayard.jpg", "./cartes/bebe_poney.jpg", "./cartes/belle_champs.jpg", "./cartes/bucephale.jpg", "./cartes/centaure.jpg", "./cartes/cheval_armure.jpg", "./cartes/cheval_boucle.jpg", "./cartes/cheval_carrosse.jpg", "./cartes/cheval_champignon.jpg", "./cartes/cheval_charbonnier.jpg", "./cartes/cheval_chinois.jpg", "./cartes/cheval_cirque.jpg", "./cartes/cheval_cowboy.jpg", "./cartes/cheval_cyberpunk.jpg", "./cartes/cheval_desert.jpg", "./cartes/cheval_diligence.jpg", "./cartes/cheval_eclair.jpg", "./cartes/cheval_enfers.jpg", "./cartes/cheval_fantome.jpg", "./cartes/cheval_fourrure.jpg", "./cartes/cheval_gourmand.jpg", "./cartes/cheval_laboureur.jpg", "./cartes/cheval_neptune.jpg", "./cartes/cheval_obstacle.jpg", "./cartes/cheval_police.jpg", "./cartes/cheval_punk.jpg", "./cartes/cheval_romain.jpg", "./cartes/cheval_rose.jpg", "./cartes/cheval_royal.jpg", "./cartes/cheval_tournoi.jpg", "./cartes/cheval_troie.jpg", "./cartes/etalon.jpg", "./cartes/hippocampe.jpg", "./cartes/kelpie.jpg", "./cartes/licorne.jpg", "./cartes/licorne_girly.jpg", "./cartes/maman_cheval.jpg", "./cartes/matsukaze.jpg", "./cartes/mustang_indien.jpg", "./cartes/pegase.jpg", "./cartes/poney_heureux.jpg", "./cartes/poney_shetland.jpg", "./cartes/poulain.jpg", "./cartes/roi_montagnes.jpg", "./cartes/secretariat.jpg", "./cartes/sleipnir.jpg", "./cartes/uchchaihshravas.jpg", "./cartes/zebre.jpg"];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(VERSION);
    await c.addAll(SHELL);
    // précache des illustrations en arrière-plan (non bloquant pour l'install)
    c.addAll(IMAGES).catch(()=>{});
    self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())if(k!==VERSION)await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.origin!==location.origin)return;           // laisse passer Google Fonts etc.
  e.respondWith((async()=>{
    const c=await caches.open(VERSION);
    const hit=await c.match(e.request,{ignoreSearch:true});
    if(hit)return hit;                               // cache-first
    try{
      const res=await fetch(e.request);
      if(res.ok)c.put(e.request,res.clone());
      return res;
    }catch(err){
      if(e.request.mode==='navigate'){const idx=await c.match('./index.html');if(idx)return idx;}
      throw err;
    }
  })());
});
