/**
 * TapMenu — Edge Function `invite-establishment`
 *
 * Emite o convite de acesso do responsável de um estabelecimento
 * pré-registado pelo Super Admin (ver migração 0500).
 *
 * Porque é uma Edge Function: criar contas e convites no Supabase Auth
 * exige a chave de serviço, que NUNCA pode estar no frontend.
 *
 * Pedido (POST, com a sessão do Super Admin no cabeçalho Authorization):
 *   { invitationId: string, delivery: 'email' | 'link', redirectTo: string }
 *
 *   - delivery 'email': o Supabase envia o email de convite.
 *   - delivery 'link':  devolve um link de convite de uso único para o
 *                       Super Admin entregar por outro canal (ex.: WhatsApp).
 *
 * O responsável define a palavra-passe ao abrir o link. Nenhuma
 * palavra-passe é criada, enviada ou guardada por esta função.
 *
 * Deploy:  supabase functions deploy invite-establishment
 */
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const fail = (status: number, code: string, message: string) => reply(status, { error: { code, message } })

/** Traduz os erros do Supabase Auth para mensagens úteis ao Super Admin. */
function authFailure(error: { message?: string; code?: string; status?: number }) {
  const msg = (error.message ?? '').toLowerCase()
  if (error.code === 'email_exists' || msg.includes('already been registered') || msg.includes('already registered')) {
    return fail(
      409,
      'user_exists',
      'Já existe uma conta ativa com este email. O responsável deve entrar com essa conta (ou recuperar a palavra-passe) — o estabelecimento fica ligado automaticamente.'
    )
  }
  if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
    return fail(429, 'rate_limited', 'Limite de envio de emails atingido. Aguarde alguns minutos ou gere um link de convite.')
  }
  return fail(400, 'auth_error', error.message || 'Não foi possível emitir o convite.')
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Método não suportado.')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return fail(500, 'misconfigured', 'Função sem configuração do Supabase.')

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })

  // 1. Quem pede tem de ser Super Admin.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return fail(401, 'not_authenticated', 'Inicie sessão para continuar.')
  const { data: callerData, error: callerError } = await admin.auth.getUser(jwt)
  if (callerError || !callerData.user) return fail(401, 'not_authenticated', 'Sessão inválida ou expirada.')
  const caller = callerData.user
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('is_super_admin, full_name, email')
    .eq('id', caller.id)
    .maybeSingle()
  if (!callerProfile?.is_super_admin) {
    return fail(403, 'forbidden', 'Apenas a equipa TapMenu pode convidar estabelecimentos.')
  }

  // 2. Validar o pedido.
  let body: { invitationId?: string; delivery?: string; redirectTo?: string }
  try {
    body = await req.json()
  } catch {
    return fail(400, 'validation', 'Pedido inválido.')
  }
  const delivery = body.delivery === 'link' ? 'link' : body.delivery === 'email' ? 'email' : null
  if (!body.invitationId || !delivery) return fail(400, 'validation', 'Indique o pré-registo e a forma de envio.')
  let redirectTo: URL
  try {
    redirectTo = new URL(body.redirectTo ?? '')
    if (redirectTo.protocol !== 'https:' && redirectTo.protocol !== 'http:') throw new Error()
  } catch {
    return fail(400, 'validation', 'Endereço de retorno inválido.')
  }

  const { data: invitation, error: invitationError } = await admin
    .from('establishment_invitations')
    .select('*')
    .eq('id', body.invitationId)
    .maybeSingle()
  if (invitationError) return fail(500, 'db_error', invitationError.message)
  if (!invitation) return fail(404, 'not_found', 'Pré-registo não encontrado.')
  if (invitation.status === 'accepted') {
    return fail(409, 'already_accepted', 'O responsável já definiu a palavra-passe. Se a esqueceu, pode recuperá-la no ecrã de entrada.')
  }

  // 3. Emitir o convite (o Supabase cria a conta sem palavra-passe).
  const meta = { full_name: invitation.owner_name }
  let userId: string
  let link: string | null = null

  if (delivery === 'email') {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(invitation.owner_email, {
      redirectTo: redirectTo.toString(),
      data: meta
    })
    if (error || !data.user) return authFailure(error ?? {})
    userId = data.user.id
  } else {
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'invite',
      email: invitation.owner_email,
      options: { redirectTo: redirectTo.toString(), data: meta }
    })
    if (error || !data.user) return authFailure(error ?? {})
    userId = data.user.id
    // Link direto para a aplicação: o token é validado lá (verifyOtp).
    const target = new URL(redirectTo.toString())
    target.searchParams.set('token_hash', data.properties.hashed_token)
    target.searchParams.set('type', 'invite')
    link = target.toString()
  }

  // 4. Exigir nova palavra-passe no primeiro acesso e registar o envio.
  const { error: profileError } = await admin.from('profiles').update({ must_change_password: true }).eq('id', userId)
  if (profileError) return fail(500, 'db_error', profileError.message)

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .from('establishment_invitations')
    .update({
      status: 'invited',
      delivery,
      user_id: userId,
      invited_at: now,
      invite_count: (invitation.invite_count ?? 0) + 1
    })
    .eq('id', invitation.id)
  if (updateError) return fail(500, 'db_error', updateError.message)

  await admin.from('audit_logs').insert({
    company_id: invitation.company_id,
    user_id: caller.id,
    user_name: callerProfile.full_name || callerProfile.email || '',
    action: 'establishment.invited',
    resource: `Establishment invitation: ${invitation.owner_email}`,
    details: delivery === 'email' ? 'Convite enviado por email.' : 'Link de convite gerado.'
  })

  return reply(200, { ok: true, delivery, email: invitation.owner_email, link, invitedAt: now })
})
