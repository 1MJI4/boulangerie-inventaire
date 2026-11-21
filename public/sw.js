// Service worker : reçoit les notifications du manager (même application fermée)
// et ouvre la bonne page au toucher. Aucune mise en cache : l'application reste
// toujours à jour. Aucun nom de client n'est jamais dans le texte reçu.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { titre: 'Pain Pâtisserie', corps: event.data ? event.data.text() : '' };
  }
  const urgente = d.urgente === true;
  event.waitUntil(
    self.registration.showNotification(d.titre || 'Pain Pâtisserie', {
      body: d.corps || '',
      icon: '/icone-192.png',
      badge: '/icone-192.png',
      tag: d.tag || undefined,
      data: { url: d.url || '/commandes' },
      // Urgente : reste affichée jusqu'au toucher, vibration longue et répétée.
      requireInteraction: urgente,
      vibrate: urgente ? [400, 150, 400, 150, 400, 150, 800] : [200, 100, 200],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/commandes';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if ('focus' in f) {
          if ('navigate' in f) f.navigate(url);
          return f.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
