/**
 * Notificações do navegador (Notification API) — para avisar o cliente
 * quando a página está aberta mas não visível (outro separador, browser
 * minimizado). Sempre com permissão explícita do utilizador.
 *
 * Limitações conhecidas:
 *  - iPhone/iPad: só existe em apps instaladas no ecrã principal (PWA,
 *    iOS 16.4+). No Safari normal não há Notification API.
 *  - Android: Chrome exige um service worker para mostrar notificações a
 *    partir da página; sem ele, `new Notification()` falha — tratado abaixo.
 *  - Com a página FECHADA só Web Push resolve (ver ./webPush.ts).
 */
export type BrowserNotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported'

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (!isBrowserNotificationSupported()) return 'unsupported'
  return Notification.permission as BrowserNotificationPermission
}

/** Pede autorização — chamar SÓ após uma ação do cliente (ex.: "Ativar"). */
export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (!isBrowserNotificationSupported()) return 'unsupported'
  try {
    const result = await Notification.requestPermission()
    return result as BrowserNotificationPermission
  } catch {
    return getBrowserNotificationPermission()
  }
}

/** Mostra uma notificação do sistema (só com permissão). Devolve true se mostrou. */
export async function showBrowserNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (getBrowserNotificationPermission() !== 'granted') return false
  const options: NotificationOptions = { body, tag, icon: '/logo/logo.PNG', badge: '/logo/logo.PNG' }
  try {
    // Com service worker ativo (PWA), é o caminho suportado em Android.
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (registration) {
      await registration.showNotification(title, options)
      return true
    }
    new Notification(title, options)
    return true
  } catch {
    return false
  }
}
