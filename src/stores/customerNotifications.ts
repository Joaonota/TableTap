import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Order } from '@/types'
import { subscribeToCustomerChannel, type CustomerChannelStatus } from '@/services'
import { customerNotificationService, type BrowserNotificationPermission } from '@/services/customerNotifications'
import {
  describeCustomerEvent,
  orderStatusEventId,
  parseCustomerEvent,
  type CustomerEvent,
  type CustomerNotificationItem
} from '@/domain/customerNotifications'

/**
 * Notificações em tempo real do CLIENTE (um dispositivo, uma sessão).
 *
 *  - Subscreve o canal privado do dispositivo (Supabase Realtime, migração 1300).
 *  - Cada alteração gera no máximo UMA notificação: os eventIds já vistos
 *    ficam guardados por sessão (o Realtime pode entregar o mesmo evento
 *    mais de uma vez, e o cliente pode recarregar a página).
 *  - `reconcile()` compara os estados dos pedidos com os últimos conhecidos
 *    — se o dispositivo perdeu eventos (sem rede, separador suspenso), o
 *    cliente é avisado uma vez quando os pedidos são recarregados.
 */

const MAX_VISIBLE = 3
const MAX_SEEN = 300
const AUTO_DISMISS_MS = 7000

const seenKey = (sessionId: string) => `tapmenu_seen_events_${sessionId}`
const statusKey = (sessionId: string) => `tapmenu_order_statuses_${sessionId}`
const SOUND_KEY = 'tapmenu_customer_sound'
const PERMISSION_PROMPT_KEY = 'tapmenu_notification_prompt_dismissed'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Sem armazenamento: a deduplicação dura apenas esta visita.
  }
}

export type CustomerEventListener = (event: CustomerEvent) => void

export const useCustomerNotificationStore = defineStore('customerNotifications', () => {
  const items = ref<CustomerNotificationItem[]>([])
  const channelStatus = ref<CustomerChannelStatus>('closed')
  const soundEnabled = ref(readJson<boolean>(SOUND_KEY, true))
  const permission = ref<BrowserNotificationPermission>(customerNotificationService.getPermission())
  const permissionPromptDismissed = ref(readJson<boolean>(PERMISSION_PROMPT_KEY, false))

  let sessionId: string | null = null
  let seen = new Set<string>()
  let knownStatuses: Record<string, string> = {}
  let stopChannel: (() => void) | null = null
  let listener: CustomerEventListener | null = null
  const timers = new Map<string, number>()

  const isConnected = computed(() => channelStatus.value === 'connected')

  /** Oferecer notificações do navegador: só se suportado, ainda por decidir e não recusado aqui. */
  const canOfferPermission = computed(
    () => permission.value === 'default' && !permissionPromptDismissed.value && customerNotificationService.isBrowserNotificationSupported()
  )

  const persist = () => {
    if (!sessionId) return
    writeJson(seenKey(sessionId), [...seen].slice(-MAX_SEEN))
    writeJson(statusKey(sessionId), knownStatuses)
  }

  const dismiss = (id: string) => {
    items.value = items.value.filter(n => n.id !== id)
    const t = timers.get(id)
    if (t) window.clearTimeout(t)
    timers.delete(id)
  }

  const show = (item: CustomerNotificationItem) => {
    // Mesmo pedido: substitui a notificação anterior (não empilhar estados do mesmo pedido).
    items.value = [item, ...items.value.filter(n => !(item.orderId && n.orderId === item.orderId))].slice(0, MAX_VISIBLE)
    // Cancelamentos ficam até o cliente fechar; os restantes desaparecem sozinhos.
    if (item.tone !== 'danger') {
      timers.set(item.id, window.setTimeout(() => dismiss(item.id), AUTO_DISMISS_MS))
    }
  }

  /** Processa um evento (do Realtime ou da reconciliação). Devolve true se era novo. */
  const handleEvent = (event: CustomerEvent): boolean => {
    // O RLS já garante o isolamento; isto é só uma salvaguarda extra.
    if (!sessionId || event.sessionId !== sessionId) return false
    if (seen.has(event.eventId)) return false
    seen.add(event.eventId)
    if (event.type === 'order.status_changed' && event.orderId && event.status) {
      knownStatuses[event.orderId] = event.status
    }
    persist()

    const content = describeCustomerEvent(event)
    if (content) {
      show({
        ...content,
        id: event.eventId,
        eventType: event.type,
        orderId: event.orderId,
        orderCode: event.orderCode,
        status: event.status,
        receivedAt: Date.now()
      })
      if (content.alert) {
        void customerNotificationService.notify({
          title: content.title,
          message: content.message,
          tag: event.eventId,
          sound: soundEnabled.value,
          vibration: soundEnabled.value
        })
      }
    }
    listener?.(event)
    return true
  }

  /**
   * Compara os pedidos recarregados com os últimos estados conhecidos.
   * Pedidos novos só definem a referência (o cliente acabou de os fazer).
   */
  const reconcile = (orders: Order[]) => {
    if (!sessionId) return
    let changed = false
    for (const order of orders) {
      const previous = knownStatuses[order.id]
      if (previous === undefined) {
        knownStatuses[order.id] = order.status
        seen.add(orderStatusEventId(order.id, order.status))
        changed = true
        continue
      }
      if (previous !== order.status) {
        handleEvent({
          eventId: orderStatusEventId(order.id, order.status),
          type: 'order.status_changed',
          sessionId,
          occurredAt: order.updatedAt ?? new Date().toISOString(),
          orderId: order.id,
          orderCode: order.orderCode,
          status: order.status,
          previousStatus: previous
        })
        knownStatuses[order.id] = order.status
        changed = true
      }
    }
    if (changed) persist()
  }

  /** Começa a ouvir a sessão deste dispositivo. Idempotente para a mesma sessão. */
  const start = (input: { sessionId: string; participantToken: string; onEvent?: CustomerEventListener }) => {
    listener = input.onEvent ?? null
    if (sessionId === input.sessionId && stopChannel) return
    stop()
    sessionId = input.sessionId
    seen = new Set(readJson<string[]>(seenKey(input.sessionId), []))
    knownStatuses = readJson<Record<string, string>>(statusKey(input.sessionId), {})
    stopChannel = subscribeToCustomerChannel(
      input.participantToken,
      raw => {
        const event = parseCustomerEvent(raw)
        if (event) handleEvent(event)
      },
      status => {
        channelStatus.value = status
      }
    )
  }

  const stop = () => {
    stopChannel?.()
    stopChannel = null
    sessionId = null
    channelStatus.value = 'closed'
    items.value = []
    timers.forEach(t => window.clearTimeout(t))
    timers.clear()
  }

  const setSoundEnabled = (value: boolean) => {
    soundEnabled.value = value
    writeJson(SOUND_KEY, value)
    if (value) customerNotificationService.playSound()
  }

  /** Pedido explícito do cliente ("Ativar"). */
  const requestPermission = async () => {
    permission.value = await customerNotificationService.requestPermission()
    if (permission.value !== 'default') dismissPermissionPrompt()
    return permission.value
  }

  const dismissPermissionPrompt = () => {
    permissionPromptDismissed.value = true
    writeJson(PERMISSION_PROMPT_KEY, true)
  }

  return {
    items,
    channelStatus,
    isConnected,
    soundEnabled,
    permission,
    canOfferPermission,
    start,
    stop,
    handleEvent,
    reconcile,
    dismiss,
    setSoundEnabled,
    requestPermission,
    dismissPermissionPrompt
  }
})
