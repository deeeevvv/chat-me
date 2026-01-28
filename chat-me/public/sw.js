// public/sw.js
const CACHE_NAME = 'chat-me-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/chat.css',
  '/chat.js',
  '/login.js',
  '/logo.jpg',
  '/google.svg',
  '/guest.svg'
];

// Install the service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch resources
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});