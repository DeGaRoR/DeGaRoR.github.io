/* Service worker — Écurie de Légendes */
const VERSION='ecurie-v17';
const SHELL=["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];
const IMAGES=["./cartes/akhal_teke.jpg", "./cartes/al_bouraq.jpg", "./cartes/andalou.jpg", "./cartes/ane_egyptien.jpg", "./cartes/ane_tetu.jpg", "./cartes/appaloosa.jpg", "./cartes/arabe.jpg", "./cartes/ardennais.jpg", "./cartes/av_enfant.jpg", "./cartes/av_etable.jpg", "./cartes/av_vent.jpg", "./cartes/bayard.jpg", "./cartes/bebe_poney.jpg", "./cartes/belle_champs.jpg", "./cartes/boulonnais.jpg", "./cartes/brabancon.jpg", "./cartes/bucephale.jpg", "./cartes/camargue.jpg", "./cartes/centaure.jpg", "./cartes/cheval_abysses.jpg", "./cartes/cheval_albinos.jpg", "./cartes/cheval_armure.jpg", "./cartes/cheval_boucle.jpg", "./cartes/cheval_carrosse.jpg", "./cartes/cheval_champignon.jpg", "./cartes/cheval_charbonnier.jpg", "./cartes/cheval_chinois.jpg", "./cartes/cheval_cirque.jpg", "./cartes/cheval_conquistador.jpg", "./cartes/cheval_constellation.jpg", "./cartes/cheval_corail.jpg", "./cartes/cheval_cosaque.jpg", "./cartes/cheval_cowboy.jpg", "./cartes/cheval_cyberpunk.jpg", "./cartes/cheval_desert.jpg", "./cartes/cheval_diligence.jpg", "./cartes/cheval_eclair.jpg", "./cartes/cheval_enfers.jpg", "./cartes/cheval_facteur.jpg", "./cartes/cheval_fantome.jpg", "./cartes/cheval_fourrure.jpg", "./cartes/cheval_glace.jpg", "./cartes/cheval_gourmand.jpg", "./cartes/cheval_halage.jpg", "./cartes/cheval_laboureur.jpg", "./cartes/cheval_neptune.jpg", "./cartes/cheval_nuages.jpg", "./cartes/cheval_obstacle.jpg", "./cartes/cheval_police.jpg", "./cartes/cheval_pompier.jpg", "./cartes/cheval_porcelaine.jpg", "./cartes/cheval_punk.jpg", "./cartes/cheval_rivieres.jpg", "./cartes/cheval_romain.jpg", "./cartes/cheval_rose.jpg", "./cartes/cheval_royal.jpg", "./cartes/cheval_samurai.jpg", "./cartes/cheval_teutonique.jpg", "./cartes/cheval_tournoi.jpg", "./cartes/cheval_troie.jpg", "./cartes/cheval_viking.jpg", "./cartes/dulmener.jpg", "./cartes/etalon.jpg", "./cartes/fjord.jpg", "./cartes/fond_belgique.jpg", "./cartes/franches_montagnes.jpg", "./cartes/frison.jpg", "./cartes/gypsy_cob.jpg", "./cartes/haflinger.jpg", "./cartes/hippocampe.jpg", "./cartes/kaltblut.jpg", "./cartes/kelpie.jpg", "./cartes/licorne.jpg", "./cartes/licorne_girly.jpg", "./cartes/lusitanien.jpg", "./cartes/maman_cheval.jpg", "./cartes/marwari.jpg", "./cartes/matsukaze.jpg", "./cartes/murgese.jpg", "./cartes/mustang_indien.jpg", "./cartes/pegase.jpg", "./cartes/pieter_jan.jpg", "./cartes/poney_heureux.jpg", "./cartes/poney_shetland.jpg", "./cartes/poulain.jpg", "./cartes/roi_montagnes.jpg", "./cartes/secretariat.jpg", "./cartes/shire.jpg", "./cartes/sleipnir.jpg", "./cartes/uchchaihshravas.jpg", "./cartes/zebre.jpg"];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(VERSION);
    await c.addAll(SHELL);
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
  if(url.origin!==location.origin)return;
  if(url.pathname.endsWith('/sw.js'))return;
  const estNav=e.request.mode==='navigate'||e.request.destination==='document';
  e.respondWith((async()=>{
    const c=await caches.open(VERSION);
    if(estNav){
      try{const res=await fetch(e.request);if(res.ok)c.put('./index.html',res.clone());return res;}
      catch(err){return (await c.match(e.request,{ignoreSearch:true}))||(await c.match('./index.html'));}
    }
    const hit=await c.match(e.request,{ignoreSearch:true});
    if(hit)return hit;
    const res=await fetch(e.request);
    if(res.ok)c.put(e.request,res.clone());
    return res;
  })());
});
