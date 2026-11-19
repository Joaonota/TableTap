/**
 * Web Push — notificações com o ecrã BLOQUEADO ou a página fechada (migração 1700).
 *
 *   1. O service worker (/sw.js) é registado.
 *   2. Com a autorização do cliente, o navegador cria uma PushSubscription
 *      com a chave pública VAPID (VITE_WEB_PUSH_PUBLIC_KEY).
 *   3. A subscrição é guardada na sessão (register_push_subscription,
 *      autorizada pelo token do participante).
 *   4. Quando o pedido muda de estado, a base de dados chama a Edge Function
 *      `send-customer-push`, que envia o push; o /sw.js mostra a notificação
 *      e o SISTEMA toca o som e vibra.
 *
 * Limitações das plataformas (não contornáveis numa página web):
 *  - iPhone/iPad: só funciona com o TapMenu adicionado ao ecrã principal
 *    (Partilhar → "Adicionar ao ecrã principal"), iOS 16.4 ou superior.
 *  - O som é o som de notificação do sistema; com o telemóvel em silêncio
 *    ou "Não incomodar" o sistema não toca.
 */
export type WebPushState = 'unsupported' | 'not_configured' | 'needs_install' | 'available'

const VAPID_PUBLIC_KEY = ((import.meta.env?.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined) ?? '').trim()
const SW_URL = '/sw.js'

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  // iPadOS apresenta-se como Mac com ecrã tátil.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** A página está a correr como app instalada (ecrã principal)? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isWebPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isWebPushConfigured(): boolean {
  return !!VAPID_PUBLIC_KEY
}

export function getWebPushState(): WebPushState {
  if (!isWebPushConfigured()) return 'not_configured'
  // No iPhone, o Safari só oferece Web Push à app instalada no ecrã principal.
  if (isIOSDevice() && !isStandalone()) return 'needs_install'
  if (!isWebPushSupported()) return 'unsupported'
  return 'available'
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Regista o service worker (sem cache — só notificações). Idempotente. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: '/' })
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

export interface WebPushKeys {
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Cria (ou reutiliza) a subscrição push deste dispositivo. Requer a
 * permissão de notificações já concedida. Devolve null se não for possível.
 */
export async function subscribeToWebPush(): Promise<WebPushKeys | null> {
  if (getWebPushState() !== 'available' || Notification.permission !== 'granted') return null
  const registration = await registerServiceWorker()
  if (!registration) return null
  try {
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
    }
    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null
    return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }
  } catch {
    return null
  }
}
