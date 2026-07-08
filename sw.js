// Service worker mínimo: cachea el "app shell" (un solo archivo, index.html)
// para que la app cargue rápido y pueda instalarse como PWA. Los datos
// (Firestore) siempre se piden frescos a la red, nunca se cachean acá.
//
// v2: antes, el fetch de la red durante el "network-first" de abajo podía
// llegar a resolverse con una copia vieja guardada en el caché HTTP normal
// del navegador (no el de este service worker) en vez de ir realmente a
// buscar la versión nueva — eso es lo que hacía que hubiera que cerrar la
// pestaña y abrir otra para ver una actualización. Ahora se fuerza
// "no-store" para que cada pedido ignore ese caché HTTP y vaya siempre a la
// red de verdad mientras haya conexión.
const CACHE_NAME = "trebol-fc-static-v2";
const APP_SHELL = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(url, { cache: "reload" }).then((res) => cache.put(url, res))
        )
      )
    )
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
  // Network-first con "no-store": siempre intenta traer la versión fresca
  // de la red (ignorando el caché HTTP del navegador), y si no hay
  // conexión, cae al cache de este service worker como respaldo (así la
  // app abre aunque sea sin internet, aunque sin datos frescos de
  // Firestore).
  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(() => caches.match(event.request))
  );
});
