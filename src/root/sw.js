/* Service worker: shows application status notifications. It does not cache anything. */
'use strict';

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  event.waitUntil(self.registration.showNotification(data.title || 'Seudocom application update', {
    body: data.body || 'Sign in to your dashboard to view your application.',
    icon: 'assets/favicon/icon-192.png',
    tag: 'seudocom-application'
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(new URL('dashboard.html', self.registration.scope).href));
});
