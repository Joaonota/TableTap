/**
 * TapMenu — Edge Function `send-customer-push` (migração 1700)
 *
 * Envia uma notificação Web Push aos telemóveis dos clientes de uma sessão
 * quando o estado do pedido / pagamento / atendimento muda. É o que faz a
 * notificação (com o som do sistema) chegar com o ecrã BLOQUEADO ou a
 * página fechada.
 *
 * Quem chama: só a base de dados (private.send_push_to_session, via pg_net),
 * com o cabeçalho `x-tapmenu-push-secret`. Não é chamada pelo navegador.
 *
 * Pedido (POST): { sessionId: string, event: CustomerEvent }  (ver migração 1300)
 *
 * Segredos (supabase secrets set …):
 *   PUSH_WEBHOOK_SECRET   igual ao segredo `tapmenu_push_secret` do Vault
 *   VAPID_PUBLIC_KEY      chave pública VAPID (igual a VITE_WEB_PUSH_PUBLIC_KEY)
 *   VAPID_PRIVATE_KEY     chave privada VAPID (só aqui — nunca no frontend)
 *   VAPID_SUBJECT         opcional: mailto:… ou https://… do TapMenu
 *
 * Deploy:  supabase functions deploy send-customer-push --no-verify-jwt
 */
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import webpush from 'npm:web-push@3.6.7'

interface CustomerEvent {
  eventId: string
  type: string
  sessionId: string
  orderCode?: string
  status?: string
  /** Modo Grupo (1800): dono do pedido / quem pagou — só ele recebe o push. */
  participantId?: string | null
}

interface PushMessage {
  title: string
  body: string
}

// Textos iguais aos de src/domain/customerNotifications.ts (notificação dentro da página).
const ORDER_MESSAGES: Record<string, PushMessage> = {
  received: { title: 'Pedido recebido', body: 'O seu pedido foi recebido e está a ser processado.' },
  confirmed: { title: 'Pedido recebido', body: 'O seu pedido foi recebido e está a ser processado.' },
  preparing: { title: 'Pedido em preparação', body: 'O seu pedido está a ser preparado.' },
  ready: { title: 'Pedido pronto', body: 'O seu pedido está pronto. Aguarde pelo atendimento.' },
  delivered: { title: 'Pedido entregue', body: 'O seu pedido foi entregue.' },
  cancelled: { title: 'Pedido cancelado', body: 'O seu pedido foi cancelado. Consulte os detalhes para mais informações.' }
}

/** Só alterações relevantes geram push (as mesmas que tocam som na página). */
function describe(event: CustomerEvent): PushMessage | null {
  switch (event.type) {
    case 'order.status_changed': {
      const base = ORDER_MESSAGES[event.status ?? '']
      if (!base) return null
      return event.orderCode ? { ...base, title: `${base.title} · ${event.orderCode}` } : base
    }
    case 'payment.confirmed':
      return event.participantId
        ? { title: 'Pagamento confirmado', body: 'O seu pagamento foi confirmado pela equipa. Obrigado!' }
        : { title: 'Pagamento confirmado', body: 'O pagamento foi confirmado pela equipa. Obrigado!' }
    case 'service_request.status_changed':
      return event.status === 'in_progress'
        ? { title: 'Pedido de atendimento recebido', body: 'A equipa já está a tratar do seu pedido.' }
        : null
    default:
      return null
  }
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Comparação em tempo constante do segredo partilhado com a base de dados. */
function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? ''
  if (!sameSecret(req.headers.get('x-tapmenu-push-secret') ?? '', secret)) {
    return json(401, { error: 'unauthorized' })
  }

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return json(500, { error: 'vapid_not_configured' })
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'https://table-tap-five.vercel.app', publicKey, privateKey)

  let body: { sessionId?: string; event?: CustomerEvent }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'invalid_body' })
  }
  const event = body.event
  if (!body.sessionId || !event?.eventId || event.sessionId !== body.sessionId) {
    return json(400, { error: 'invalid_event' })
  }
  const message = describe(event)
  if (!message) return json(200, { sent: 0, skipped: 'no_notification' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false }
  })
  // Pedidos e pagamentos de uma pessoa: só o telemóvel dela (não expor consumos aos outros).
  let query = admin.from('push_subscriptions').select('id, endpoint, p256dh, auth, page_url').eq('session_id', body.sessionId)
  if (event.participantId) query = query.eq('participant_id', event.participantId)
  const { data: subs, error } = await query
  if (error) return json(500, { error: 'db_error', message: error.message })

  let sent = 0
  const expired: string[] = []
  await Promise.all(
    (subs ?? []).map(async sub => {
      const payload = JSON.stringify({
        title: message.title,
        body: message.body,
        // A mesma tag da notificação da página: nunca aparece duas vezes.
        tag: event.eventId,
        url: sub.page_url ?? '/',
        eventId: event.eventId
      })
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
          TTL: 60 * 60,
          // "high" acorda o telemóvel bloqueado (Android em modo de poupança).
          urgency: 'high',
          topic: event.eventId.replace(/[^A-Za-z0-9_-]/g, '').slice(-32)
        })
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        // 404/410: o navegador anulou a subscrição — apagar.
        if (status === 404 || status === 410) expired.push(sub.id)
        else console.error('push falhou', status, (e as Error).message)
      }
    })
  )
  if (expired.length) await admin.from('push_subscriptions').delete().in('id', expired)

  return json(200, { sent, expired: expired.length })
})
