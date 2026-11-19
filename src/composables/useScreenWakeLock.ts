import { ref, watch, onUnmounted, type Ref } from 'vue'

/**
 * Mantém o ecrã ligado (Screen Wake Lock API) enquanto `active` for true.
 *
 * Porquê: no iPhone, uma página web não recebe notificações com o ecrã
 * bloqueado. Enquanto o cliente espera pelo pedido, o ecrã não apaga e o
 * aviso (com som) da página continua a funcionar.
 *
 *  - O sistema solta o bloqueio quando a página fica escondida (outra app,
 *    botão de bloquear): volta a pedir quando a página fica visível.
 *  - Alguns navegadores (Safari) só aceitam o pedido depois de um toque na
 *    página: se falhar, tenta de novo no próximo toque.
 *  - Suportado no Safari/iOS 16.4+ e Chrome/Android; noutros não faz nada.
 */
interface WakeLockSentinelLike {
  released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}

type WakeLockNavigator = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> }
}

export function useScreenWakeLock(active: Ref<boolean>) {
  const nav = typeof navigator !== 'undefined' ? (navigator as WakeLockNavigator) : undefined
  const isSupported = !!nav?.wakeLock
  const isLocked = ref(false)

  let sentinel: WakeLockSentinelLike | null = null
  let requesting = false
  let waitingForGesture = false

  const onGesture = () => {
    removeGestureListeners()
    void acquire()
  }
  const addGestureListeners = () => {
    if (waitingForGesture) return
    waitingForGesture = true
    document.addEventListener('touchend', onGesture, { passive: true })
    document.addEventListener('click', onGesture)
  }
  const removeGestureListeners = () => {
    if (!waitingForGesture) return
    waitingForGesture = false
    document.removeEventListener('touchend', onGesture)
    document.removeEventListener('click', onGesture)
  }

  const acquire = async () => {
    if (!isSupported || !active.value || requesting || (sentinel && !sentinel.released)) return
    if (document.visibilityState !== 'visible') return
    requesting = true
    try {
      sentinel = await nav!.wakeLock!.request('screen')
      isLocked.value = true
      sentinel.addEventListener('release', () => {
        isLocked.value = false
      })
      // Entretanto deixou de ser preciso (pedido entregue).
      if (!active.value) await release()
    } catch {
      // Sem gesto prévio ou poupança de energia: tentar no próximo toque.
      addGestureListeners()
    } finally {
      requesting = false
    }
  }

  const release = async () => {
    removeGestureListeners()
    const current = sentinel
    sentinel = null
    isLocked.value = false
    try {
      if (current && !current.released) await current.release()
    } catch {
      // Já libertado pelo sistema.
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible' && active.value) void acquire()
  }

  if (isSupported) {
    document.addEventListener('visibilitychange', onVisibility)
    watch(active, value => (value ? void acquire() : void release()), { immediate: true })
  }

  onUnmounted(() => {
    if (!isSupported) return
    document.removeEventListener('visibilitychange', onVisibility)
    void release()
  })

  return { isSupported, isLocked }
}
