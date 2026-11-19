/**
 * Som curto de notificação — funciona em iPhone, Android e computador.
 *
 * Regras dos navegadores móveis:
 *  - Só se pode tocar som depois de um GESTO que "ativa" a página. Num ecrã
 *    tátil isso é `touchend` / `click` / `pointerup` — NÃO `pointerdown`.
 *  - Um <audio> que já tocou dentro de um gesto pode voltar a tocar mais
 *    tarde sem gesto (é o que permite o som quando chega a notificação).
 *  - Web Audio no iPhone obedece ao botão de silêncio e fica suspenso quando
 *    a página vai para segundo plano; por isso o caminho principal é um
 *    <audio> com o som gerado em WAV, e Web Audio fica como alternativa.
 *
 * O som é gerado aqui (sem ficheiros): duas notas curtas (~0,4 s).
 */

let audioEl: HTMLAudioElement | null = null
let audioUnlocked = false
let ctx: AudioContext | null = null
let lastPlayedAt = 0
/** Intervalo mínimo entre sons — nunca tocar em rajada. */
const MIN_INTERVAL_MS = 1500

type AudioContextCtor = typeof AudioContext

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export function isSoundSupported(): boolean {
  return typeof window !== 'undefined' && (typeof Audio !== 'undefined' || !!getAudioContextCtor())
}

// ---------------------------------------------------------------------
// Som gerado (WAV PCM 16-bit mono)
// ---------------------------------------------------------------------
function buildChimeWav(): Blob {
  const sampleRate = 22050
  const duration = 0.42
  const n = Math.floor(sampleRate * duration)
  const samples = new Float32Array(n)
  const note = (freq: number, start: number, length: number) => {
    const s0 = Math.floor(start * sampleRate)
    const len = Math.floor(length * sampleRate)
    for (let i = 0; i < len && s0 + i < n; i++) {
      const t = i / sampleRate
      // Ataque rápido + decaimento exponencial (som de "notificação").
      const env = Math.min(1, t / 0.012) * Math.exp(-t * 9)
      samples[s0 + i] += Math.sin(2 * Math.PI * freq * t) * env
    }
  }
  note(880, 0, 0.2) // Lá5
  note(1318.5, 0.13, 0.28) // Mi6

  const buffer = new ArrayBuffer(44 + n * 2)
  const view = new DataView(buffer)
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + n * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] * 0.7))
    view.setInt16(44 + i * 2, v * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

function ensureAudioElement(): HTMLAudioElement | null {
  if (audioEl) return audioEl
  if (typeof Audio === 'undefined' || typeof URL === 'undefined') return null
  try {
    audioEl = new Audio(URL.createObjectURL(buildChimeWav()))
    audioEl.preload = 'auto'
    audioEl.setAttribute('playsinline', '')
  } catch {
    audioEl = null
  }
  return audioEl
}

function ensureAudioContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = getAudioContextCtor()
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    ctx = null
  }
  return ctx
}

/** Desbloqueio dentro de um gesto: toca o <audio> em silêncio e retoma o Web Audio. */
function unlockNow() {
  const el = ensureAudioElement()
  if (el && !audioUnlocked) {
    el.muted = true
    const p = el.play()
    const done = () => {
      el.pause()
      el.currentTime = 0
      el.muted = false
    }
    if (p && typeof p.then === 'function') {
      p.then(() => {
        done()
        audioUnlocked = true
      }).catch(() => {
        el.muted = false
      })
    } else {
      done()
      audioUnlocked = true
    }
  }
  const c = ensureAudioContext()
  if (c && c.state !== 'running') void c.resume().catch(() => {})
}

const isFullyUnlocked = () => audioUnlocked && (!ctx || ctx.state === 'running')

/**
 * Prepara o som no(s) primeiro(s) toque(s) na página. Continua a escutar
 * até o áudio estar realmente desbloqueado e volta a desbloquear quando o
 * navegador o suspende (ex.: depois de a página ter ido para segundo plano).
 */
export function unlockAudioOnFirstGesture(): () => void {
  if (typeof window === 'undefined') return () => {}
  // Eventos que contam como gesto do utilizador em ecrãs táteis e com rato.
  const events = ['touchend', 'click', 'pointerup', 'keydown'] as const
  const onGesture = () => {
    if (!isFullyUnlocked()) unlockNow()
  }
  events.forEach(e => window.addEventListener(e, onGesture, { passive: true, capture: true }))
  return () => events.forEach(e => window.removeEventListener(e, onGesture, { capture: true }))
}

function playWithWebAudio(): boolean {
  const c = ensureAudioContext()
  if (!c) return false
  const play = () => {
    try {
      const master = c.createGain()
      master.gain.value = 0.2
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
      tone(880, 0, 0.18)
      tone(1318.5, 0.13, 0.26)
    } catch {
      // ignorar
    }
  }
  if (c.state === 'running') {
    play()
    return true
  }
  // Suspenso (ex.: depois de segundo plano): tentar retomar e tocar.
  void c
    .resume()
    .then(() => {
      if (c.state === 'running') play()
    })
    .catch(() => {})
  return true
}

/** Toca o som de notificação. Devolve false se não foi possível (sem gesto prévio, por exemplo). */
export function playNotificationSound(): boolean {
  const now = Date.now()
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return false
  lastPlayedAt = now

  const el = ensureAudioElement()
  if (el) {
    try {
      el.muted = false
      el.volume = 1
      el.currentTime = 0
      const p = el.play()
      if (p && typeof p.catch === 'function') {
        // Sem autorização para o <audio>: tentar Web Audio.
        p.catch(() => playWithWebAudio())
      }
      return true
    } catch {
      // continua para Web Audio
    }
  }
  return playWithWebAudio()
}
