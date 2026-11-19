/*
 * TapMenu — service worker (só notificações; não guarda nada em cache).
 *
 * Recebe o Web Push enviado pela Edge Function `send-customer-push` e mostra
 * a notificação do SISTEMA — é o sistema (Android / iOS) que toca o som e
 * vibra, mesmo com o ecrã bloqueado ou a página fechada.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

const isIOS = /iPad|iPhone|iPod/.test(self.navigator.userAgent)

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'TapMenu', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'TapMenu'
  const options = {
    body: data.body || '',
    tag: data.tag || undefined,
    icon: '/logo/logo-icon-192.png',
    badge: '/logo/logo-icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      // Página aberta e à vista: já mostrou o aviso e tocou o som (Realtime).
      // No iPhone é obrigatório mostrar sempre a notificação de um push.
      const visible = windows.some(w => w.visibilityState === 'visible' && w.focused)
      if (visible && !isIOS) return undefined
      return self.registration.showNotification(title, options)
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const same = windows.find(w => w.url === target) || windows.find(w => w.url.startsWith(self.location.origin))
      if (same) {
        if (same.url !== target && 'navigate' in same) return same.navigate(target).then(w => w && w.focus())
        return same.focus()
      }
      return self.clients.openWindow(target)
    })
  )
})
