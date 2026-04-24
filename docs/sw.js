// Service Worker for 体育館予約管理 push notifications

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || '体育館予約管理', {
      body: data.body || '',
      icon: '/taiikukan-app/favicon.svg',
      badge: '/taiikukan-app/favicon.svg',
      tag: 'taiikukan-notification',
      data: { url: self.location.origin + '/taiikukan-app/#/home' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || self.location.origin + '/taiikukan-app/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()))
