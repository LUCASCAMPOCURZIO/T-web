// Service worker mínimo: cachea el "app shell" (un solo archivo, index.html)
// para que la app cargue rápido y pueda instalarse como PWA. Los datos
// (Firestore) siempre se piden frescos a la red, nunca se cachean acá.
const CACHE_NAME = "trebol-fc-static-v1";
const APP_SHELL = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Network-first: siempre intenta traer la versión fresca, y si no hay
  // conexión, cae al cache como respaldo (así la app abre aunque sea sin
  // internet, aunque sin datos frescos de Firestore).
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
