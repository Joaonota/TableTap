/**
 * Web Push (notificações com a página FECHADA) — arquitetura preparada,
 * ainda não ativa.
 *
 * Para ativar numa próxima etapa:
 *  1. Gerar chaves VAPID e definir VITE_WEB_PUSH_PUBLIC_KEY (pública) no
 *     frontend; a chave privada fica só no servidor (Edge Function).
 *  2. Registar um service worker (ex.: /sw.js) que trate o evento `push`
 *     e `notificationclick` (abrir a URL da mesa).
 *  3. Guardar a PushSubscription do dispositivo ligada ao participante da
 *     sessão (tabela própria, escrita por RPC autorizada pelo token).
 *  4. Uma Edge Function envia o push quando os triggers da migração 1300
 *     emitem eventos (ex.: via pg_net / database webhook), usando os mesmos
 *     textos de src/domain/customerNotifications.ts.
 *
 * Até lá, isWebPushConfigured() devolve false e o TapMenu usa as
 * notificações em tempo real enquanto a página está aberta.
 */
export type WebPushState = 'unsupported' | 'not_configured' | 'available'

const VAPID_PUBLIC_KEY = ((import.meta.env?.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined) ?? '').trim()

export function isWebPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isWebPushConfigured(): boolean {
  return !!VAPID_PUBLIC_KEY
}

export function getWebPushState(): WebPushState {
  if (!isWebPushSupported()) return 'unsupported'
  return isWebPushConfigured() ? 'available' : 'not_configured'
}

/**
 * Subscreve o dispositivo para Web Push. Ainda não implementado: devolve o
 * estado atual para quem chama decidir (sem falsas promessas ao cliente).
 */
export async function subscribeToWebPush(): Promise<{ ok: false; state: WebPushState }> {
  return { ok: false, state: getWebPushState() }
}
