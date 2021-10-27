var CACHE_NAME = 'my-site-cache-v1';
var urlsToCache = [
  '/XBC/',
  '/XBC/index.html',
  '/XBC/font-awesome/css/font-awesome.min.css',
  '/XBC/xBosonConquest.css',
  '/XBC/css/materialize.css',
  '/XBC/css/style.css',
  '/XBC/fontawesome2021/css/all.css',
  '/XBC/Resources/Background/small_object_L.png',
  '/XBC/Resources/Background/small_object_M.png', 	
  '/XBC/Resources/Background/small_object_S.png', 	
  '/XBC/Resources/Background/big_object_1.png',
  '/XBC/Resources/Background/big_object_2.png',
  '/XBC/Resources/Background/big_object_3.png',
  '/XBC/Resources/Background/big_object_1_r.png', 	
  '/XBC/Resources/Background/big_object_2_r.png',	
  '/XBC/Resources/Background/big_object_3_r.png',	
  '/XBC/Resources/Background/big_object_1_b.png',	
  '/XBC/Resources/Background/big_object_2_b.png',	
  '/XBC/Resources/Background/big_object_3_b.png',	
  '/XBC/Resources/Bases/cell3D_S.png',	
  '/XBC/Resources/Bases/cell3D_M.png',				
  '/XBC/Resources/Bases/cell3D_L.png',				
  '/XBC/Resources/Bases/fungus3D_S.png', 			
  '/XBC/Resources/Bases/fungus3D_M.png',			
  '/XBC/Resources/Bases/fungus3D_L.png',			
  '/XBC/Resources/Bases/virus3D_S.png',		
  '/XBC/Resources/Bases/virus3D_M.png',			
  '/XBC/Resources/Bases/virus3D_L.png',			
  '/XBC/Resources/loading/ellipsis.svg',
  '/XBC/Resources/Background/Clouds_trans_tile_black.png',
  '/XBC/Resources/titleBanner2_SD.webp',
  '/XBC/XBC_levels.js',
  '/XBC/xBosonConquest.js',
  '/XBC/js/materialize.min.js',
  '/XBC/materializeInit.js',
  '/XBC/Resources/ico/XBC_ICO_32.png',
  '/XBC/Resources/ico/XBC_ICO_64.png',
  '/XBC/Resources/ico/XBC_ICO_128.png',
  '/XBC/Resources/ico/XBC_ICO_256.png',
  '/XBC/Resources/ico/XBC_ICO_512.png'
  
];

self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          function(response) {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});