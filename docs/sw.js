// Offline-Unterstützung: App-Dateien und Texterkennungs-Bibliothek zwischenspeichern.
const VERSION = 'motolog-v1';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/db.js', './js/format.js', './js/images.js', './js/ocr.js', './js/parsers.js', './js/ui.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Tesseract-Bibliothek & Sprachdaten: einmal laden, dann aus dem Cache
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    }));
    return;
  }

  // Eigene Dateien: Netz zuerst (immer aktuell), offline aus dem Cache
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(VERSION).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit ?? caches.match('./index.html'))),
    );
  }
});
