/* eslint-disable no-restricted-globals */
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const title = data.title || 'PingusLove'
  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: '/pinguslove-icon.png',
    badge: '/pinguslove-icon.png',
    tag: data.tag || 'pinguslove-notification',
    data: { url: data.url || '/notifications' },
    requireInteraction: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/notifications'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
