
const CACHE_NAME = 'editor-cache-v1';
const URLS_TO_CACHE = ['/', '/bundle.js', '/index.html', '/styles.css', '/service-worker.js'];

self.addEventListener('install', event => {
    self.skipWaiting(); 
    event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(response => response || new Response('Offline'))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => 
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
  self.clients.claim(); 
});

