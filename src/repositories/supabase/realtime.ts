import { supabase, isSupabaseConfigured } from '@/lib/supabase'

/** Tabelas publicadas no Realtime (ver migration 0400). */
export type RealtimeTable = 'orders' | 'service_requests' | 'notifications' | 'dining_tables' | 'table_sessions'

/**
 * Escuta alterações (insert/update/delete) de um restaurante numa tabela.
 * O Realtime aplica o RLS: só chegam eventos de linhas que o utilizador pode
 * ler. Devolve a função para cancelar a subscrição.
 */
export function subscribeToRestaurant(table: RealtimeTable, restaurantId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured || !restaurantId) return () => {}
  let timer: ReturnType<typeof setTimeout> | undefined
  // Agrupa rajadas de eventos (ex.: pedido + itens) numa só recarga.
  const debounced = () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, 250)
  }
  const channel = supabase
    .channel(`${table}:${restaurantId}:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter: `restaurant_id=eq.${restaurantId}` }, debounced)
    .subscribe()
  return () => {
    clearTimeout(timer)
    void supabase.removeChannel(channel)
  }
}

// =====================================================================
// Canal privado do CLIENTE (menu da mesa) — migração 1300
// =====================================================================

export type CustomerChannelStatus = 'connecting' | 'connected' | 'error' | 'closed'

/**
 * Escuta os eventos enviados pela base de dados para ESTE dispositivo
 * (topic `customer:<token do participante>`, Broadcast privado).
 * O RLS em realtime.messages só autoriza o canal a quem tem o token de uma
 * sessão válida; os eventos chegam apenas aos participantes da sessão.
 * Devolve a função para cancelar a subscrição.
 */
export function subscribeToCustomerChannel(
  participantToken: string,
  onEvent: (payload: unknown) => void,
  onStatus?: (status: CustomerChannelStatus) => void
): () => void {
  if (!isSupabaseConfigured || !participantToken) return () => {}
  onStatus?.('connecting')
  const channel = supabase
    .channel(`customer:${participantToken}`, { config: { private: true, broadcast: { self: false } } })
    .on('broadcast', { event: '*' }, message => onEvent(message.payload))
    .subscribe(status => {
      if (status === 'SUBSCRIBED') onStatus?.('connected')
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onStatus?.('error')
      else if (status === 'CLOSED') onStatus?.('closed')
    })
  return () => {
    void supabase.removeChannel(channel)
  }
}
