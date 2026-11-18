/**
 * Som curto de notificação (sem ficheiros de áudio: gerado com Web Audio).
 *
 * Os navegadores (sobretudo iPhone/Safari e Chrome Android) só permitem
 * áudio depois de um gesto do utilizador. `unlockAudioOnFirstGesture`
 * prepara o áudio no primeiro toque na página; até lá, playSound() não faz
 * nada (a notificação visual aparece na mesma).
 */
type AudioContextCtor = typeof AudioContext

let ctx: AudioContext | null = null
let lastPlayedAt = 0
/** Intervalo mínimo entre sons — nunca tocar em rajada. */
const MIN_INTERVAL_MS = 1500

function getCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export function isSoundSupported(): boolean {
  return !!getCtor()
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = getCtor()
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    ctx = null
  }
  return ctx
}

/** Desbloqueia o áudio no primeiro toque/tecla (requisito dos navegadores móveis). */
export function unlockAudioOnFirstGesture(): () => void {
  if (typeof window === 'undefined') return () => {}
  const unlock = () => {
    const c = ensureContext()
    if (c && c.state === 'suspended') void c.resume().catch(() => {})
    // Um buffer silencioso "acorda" o áudio no iOS.
    if (c) {
      try {
        const source = c.createBufferSource()
        source.buffer = c.createBuffer(1, 1, 22050)
        source.connect(c.destination)
        source.start(0)
      } catch {
        // ignorar
      }
    }
    remove()
  }
  const remove = () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    window.removeEventListener('touchend', unlock)
  }
  window.addEventListener('pointerdown', unlock, { once: true, passive: true })
  window.addEventListener('keydown', unlock, { once: true })
  window.addEventListener('touchend', unlock, { once: true, passive: true })
  return remove
}

/** Duas notas curtas e suaves (~0,35 s), semelhantes a uma notificação de aplicação. */
export function playNotificationSound(): boolean {
  const now = Date.now()
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return false
  const c = ensureContext()
  if (!c || c.state !== 'running') return false
  lastPlayedAt = now
  try {
    const master = c.createGain()
    master.gain.value = 0.18
    master.connect(c.destination)
    const tone = (freq: number, start: number, duration: number) => {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t0 = c.currentTime + start
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(1, t0 + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
      osc.connect(gain)
      gain.connect(master)
      osc.start(t0)
      osc.stop(t0 + duration + 0.02)
    }
    tone(880, 0, 0.16) // Lá5
    tone(1318.5, 0.12, 0.22) // Mi6
    return true
  } catch {
    return false
  }
}
