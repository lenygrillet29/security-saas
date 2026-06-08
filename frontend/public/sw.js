// Service Worker — SecuroPlan PWA
const CACHE_NAME = 'securoplan-v2';

const STATIC_ASSETS = ['/', '/dashboard', '/planning', '/agents'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Notifications push ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { title: 'SecuroPlan', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'SecuroPlan', {
      body:    data.body   || '',
      icon:    data.icon   || '/icon-192.png',
      badge:   data.badge  || '/icon-192.png',
      tag:     data.tag    || 'securoplan',
      vibrate: [200, 100, 200],
      data:    data.data   || {},
    })
  );
});

// Clic sur la notification → ouvrir l'app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          return;
        }
      }
      clients.openWindow(url);
    })
  );
});
