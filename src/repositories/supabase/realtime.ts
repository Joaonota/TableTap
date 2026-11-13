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
