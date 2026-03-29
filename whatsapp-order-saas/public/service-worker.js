self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open('whatsorder-cache-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/favicon.ico',
        '/manifest.json',
        '/dashboard',
        '/dashboard/orders',
        '/dashboard/products',
        '/dashboard/customers',
        '/dashboard/settings',
        '/app/globals.css',
        // Add more static assets and key pages as needed
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== 'whatsorder-cache-v1').map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
