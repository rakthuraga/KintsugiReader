const CACHE = 'kintsugi-reader-v1';
const OFFLINE_ASSETS = [
  './',
  './index.html',
  './assets/css/styles.css',
  './assets/js/main.js',
  './assets/data/sample-book.json',
  './assets/images/page1.svg',
  './assets/images/page1@2x.svg',
  './assets/images/page2.svg',
  './assets/images/page2@2x.svg',
  './assets/images/page3.svg',
  './assets/images/page3@2x.svg',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_NOW') {
    event.waitUntil(
      caches.open(CACHE).then((cache) =>
        cache.addAll(OFFLINE_ASSETS).then(() => {
          self.clients.matchAll().then((clients) => {
            clients.forEach((client) => client.postMessage('CACHE_DONE'));
          });
        }),
      ),
    );
  }
});
