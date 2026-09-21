const CACHE_NAME = 'smart-timetable-v39';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/timeline.js',
  '/js/timetable_store.js',
  '/js/widget_helper.js',
  '/js/subject_normalizer.js',
  '/data/volta_classes.json',
  '/data/timetable.json',
  '/manifest.json',
  '/icons/icon.svg',
  '/orario-originale/',
  '/orario-originale/index.html',
  '/orario-originale/_style.css',
  '/orario-originale/_impression.css',
  '/orario-originale/_affichage.js',
  '/orario-originale/_bandeau.js',
  '/orario-originale/_genre.js',
  '/orario-originale/_ressource.js',
  '/orario-originale/_periode.js',
  '/orario-originale/_grille.js',
  '/orario-originale/_signature.js',
  '/orario-originale/_panzoom.js',
  '/orario-originale/classi/edc0000119p00001s3fffffffffffffff_4_binf_ac.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Gestisci solo richieste GET HTTP/HTTPS
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  const url = new URL(event.request.url);

  // 1. Endpoint API serverless: bypass totale del SW (sempre da rete, mai cached nel SW)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Dati dinamici orario (/data/): Network-First con fallback su Cache offline
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone).catch(() => {});
            }).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || caches.match('/data/timetable.json')))
    );
    return;
  }

  // 3. Pagine e navigazione HTML: Network-First con fallback su index.html in cache
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone).catch(() => {});
            }).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || caches.match('/index.html') || caches.match('/')))
    );
    return;
  }

  // 4. Asset statici (JS, CSS, Immagini, Icone): Stale-While-Revalidate per avvio istantaneo a 120Hz
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone).catch(() => {});
            }).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
