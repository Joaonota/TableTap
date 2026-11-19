import { ref, computed } from 'vue'
import { orderService, tableSessionService } from '@/services'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import type { Order, TableSession } from '@/types'

/** Estados de pagamento que contam como pago. */
const SETTLED = new Set<Order['paymentStatus']>(['paid', 'confirmed'])

/**
 * Depois de a equipa marcar um pagamento como pago: se TODOS os pedidos da
 * sessão da mesa estiverem pagos, pergunta se quer encerrar a sessão. Só
 * encerra com confirmação explícita ("Encerrar sessão"); "Manter aberta"
 * não faz nada. Encerrar dispara o fim da sessão no telemóvel do cliente
 * (agradecimento e avaliação Google).
 */
export function useCloseSessionAfterPayment() {
  const authStore = useAuthStore()
  const toastStore = useToastStore()

  const isOpen = ref(false)
  const isClosing = ref(false)
  const session = ref<TableSession | null>(null)
  const tableNumber = ref('')
  const paidOrders = ref(0)
  const sessionTotal = ref(0)

  const title = computed(() => `Encerrar a sessão da Mesa ${tableNumber.value}?`)
  const message = computed(
    () =>
      `Todos os pedidos desta mesa estão pagos (${paidOrders.value} ${paidOrders.value === 1 ? 'pedido' : 'pedidos'}, ` +
      `${sessionTotal.value.toLocaleString('pt-MZ')} MT). Ao encerrar, a mesa fica livre e o cliente vê o ecrã de agradecimento.`
  )

  /** Chamar logo depois de um pagamento ficar "pago". */
  const checkAfterPayment = async (orderId: string) => {
    try {
      const order = await orderService.getOrderById(orderId)
      if (!order?.tableSessionId || !SETTLED.has(order.paymentStatus)) return
      const current = await tableSessionService.getSessionById(order.tableSessionId)
      if (!current || current.status !== 'active') return

      const orders = (await Promise.all(current.orderIds.map(id => orderService.getOrderById(id))))
        .filter((o): o is Order => !!o && o.status !== 'cancelled')
      const unpaid = orders.filter(o => !SETTLED.has(o.paymentStatus))
      if (unpaid.length) {
        toastStore.info(
          'Sessão continua aberta',
          `Ainda ${unpaid.length === 1 ? 'falta 1 pedido' : `faltam ${unpaid.length} pedidos`} por pagar na Mesa ${order.tableNumber}.`
        )
        return
      }

      session.value = current
      tableNumber.value = order.tableNumber || ''
      paidOrders.value = orders.length
      sessionTotal.value = orders.reduce((sum, o) => sum + o.total, 0)
      isOpen.value = true
    } catch {
      // A confirmação do pagamento já foi feita; a pergunta é só uma ajuda.
    }
  }

  const confirmClose = async () => {
    if (!session.value) return
    isClosing.value = true
    try {
      await tableSessionService.closeSession(session.value.id, authStore.currentUser?.name || 'Equipa do restaurante')
      toastStore.success('Sessão encerrada', `A Mesa ${tableNumber.value} ficou livre.`)
      isOpen.value = false
      session.value = null
    } catch (e) {
      toastStore.error('Não foi possível encerrar a sessão', (e as Error).message)
    } finally {
      isClosing.value = false
    }
  }

  /** "Manter aberta": não altera nada. */
  const keepOpen = () => {
    isOpen.value = false
    session.value = null
  }

  return { isOpen, isClosing, title, message, checkAfterPayment, confirmClose, keepOpen }
}
