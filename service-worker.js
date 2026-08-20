// Daily Streak has moved to https://dailystreak-five.vercel.app/ — this kill-switch replaces
// the old app-shell-caching service worker so returning visitors' browsers don't keep serving
// the stale cached vanilla app instead of the redirect in index.html. Clears all caches,
// unregisters itself, then forces any open tabs to reload (now uncontrolled, straight from
// the network) so the redirect actually runs instead of getting served from cache again.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => clients.forEach((client) => client.navigate(client.url)))
  );
});
