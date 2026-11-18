/**
 * Serviço de notificações do cliente (menu da mesa).
 *
 *   notify()            → som + vibração (+ notificação do sistema se a página não estiver visível)
 *   playSound()         → som curto (só depois do primeiro toque na página)
 *   vibrate()           → vibração curta, se suportada
 *   requestPermission() → autorização do navegador, pedida só após ação do cliente
 *
 * A notificação visual dentro da página é gerida pela store
 * (src/stores/customerNotifications.ts) e pelo CustomerNotificationStack.
 */
import { playNotificationSound, unlockAudioOnFirstGesture, isSoundSupported } from './sound'
import {
  getBrowserNotificationPermission,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  type BrowserNotificationPermission
} from './browserNotifications'
import { getWebPushState, isWebPushSupported, subscribeToWebPush, type WebPushState } from './webPush'

export type { BrowserNotificationPermission, WebPushState }

/** Vibração curta (Android). iPhone/Safari não suporta — ignora em silêncio. */
function vibrate(pattern: number | number[] = [60, 40, 60]): boolean {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      return navigator.vibrate(pattern)
    }
  } catch {
    // Alguns navegadores lançam erro sem gesto prévio do utilizador.
  }
  return false
}

const isPageVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible'

export const customerNotificationService = {
  unlockAudioOnFirstGesture,
  isSoundSupported,
  playSound: playNotificationSound,
  vibrate,

  isBrowserNotificationSupported,
  getPermission: getBrowserNotificationPermission,
  requestPermission: requestBrowserNotificationPermission,

  isWebPushSupported,
  getWebPushState,
  subscribeToWebPush,

  /**
   * Alerta do dispositivo para uma notificação relevante. Com a página
   * visível: som + vibração. Com a página escondida: notificação do sistema
   * (se autorizada) — o som não é fiável em segundo plano.
   */
  async notify(input: { title: string; message: string; tag: string; sound: boolean; vibration: boolean }) {
    if (isPageVisible()) {
      if (input.sound) playNotificationSound()
      if (input.vibration) vibrate()
      return
    }
    const shown = await showBrowserNotification(input.title, input.message, input.tag)
    if (!shown && input.vibration) vibrate()
  }
}
