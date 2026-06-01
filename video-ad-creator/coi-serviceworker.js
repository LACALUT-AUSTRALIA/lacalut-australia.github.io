/* coi-serviceworker v0.1.7 - Guido Zuidhof, licensed under MIT
   Enables SharedArrayBuffer on GitHub Pages by injecting COOP/COEP headers via service worker. */
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
  self.addEventListener('fetch', function (event) {
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;
    event.respondWith(
      fetch(event.request).then(function (response) {
        if (response.status === 0) return response;
        const h = new Headers(response.headers);
        h.set('Cross-Origin-Opener-Policy', 'same-origin');
        h.set('Cross-Origin-Embedder-Policy', 'require-corp');
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
      }).catch((e) => console.error(e))
    );
  });
} else {
  (() => {
    const reloaded = window.sessionStorage.getItem('coiReloadedBySelf');
    window.sessionStorage.removeItem('coiReloadedBySelf');
    if (window.crossOriginIsolated) return;
    if (reloaded) { console.warn('COI: would reload infinitely, aborting.'); return; }
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(window.document.currentScript.src).then(function (reg) {
      if (reg.active && !navigator.serviceWorker.controller) {
        window.sessionStorage.setItem('coiReloadedBySelf', 'true');
        window.location.reload();
      }
    }, function (err) { console.error('COI SW failed:', err); });
  })();
}
