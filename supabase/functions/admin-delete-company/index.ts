/**
 * TapMenu — Edge Function `admin-delete-company`
 *
 * Elimina permanentemente uma empresa e todos os dados associados.
 * Só o Super Admin do Sistema (ver migração 0900).
 *
 * Passos:
 *   1. Confirma que quem pede é Super Admin.
 *   2. Chama `admin_delete_company` COM A SESSÃO DO SUPER ADMIN: a base de
 *      dados volta a validar a permissão e o nome de confirmação, e apaga
 *      todos os dados numa única transação (sem órfãos; histórico global
 *      registado).
 *   3. Remove os ficheiros da empresa no Storage (bucket `media`,
 *      pasta `{companyId}/`).
 *   4. Remove as contas do Supabase Auth que pertenciam só a esta empresa
 *      (lista em `pending_auth_deletions`). Uma conta que falhe fica na
 *      lista e é tentada de novo na próxima execução da função.
 *
 * Porque é uma Edge Function: remover contas do Supabase Auth e ficheiros
 * do Storage exige a chave de serviço, que NUNCA pode estar no frontend.
 *
 * Pedido (POST, com a sessão do Super Admin no cabeçalho Authorization):
 *   { companyId: string, confirmName: string }
 *
 * Deploy:  supabase functions deploy admin-delete-company
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const fail = (status: number, code: string, message: string) => reply(status, { error: { code, message } })

const MEDIA_BUCKET = 'media'

/** Lista recursivamente todos os ficheiros debaixo de `prefix`. */
async function listFiles(admin: SupabaseClient, prefix: string): Promise<string[]> {
  const files: string[] = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage.from(MEDIA_BUCKET).list(prefix, { limit: pageSize, offset })
    if (error) throw error
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`
      // Pastas não têm id no Storage do Supabase.
      if (entry.id === null) files.push(...(await listFiles(admin, path)))
      else files.push(path)
    }
    if (!data || data.length < pageSize) break
  }
  return files
}

async function removeCompanyFiles(admin: SupabaseClient, companyId: string) {
  try {
    const files = await listFiles(admin, companyId)
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await admin.storage.from(MEDIA_BUCKET).remove(files.slice(i, i + 100))
      if (error) throw error
    }
    return { removed: files.length, error: null as string | null }
  } catch (e) {
    return { removed: 0, error: (e as Error).message ?? 'Erro desconhecido no Storage.' }
  }
}

interface PendingRow {
  user_id: string
  email: string
  company_id: string
  attempts: number
}

/** Remove as contas Auth pendentes (desta empresa e de execuções anteriores que falharam). */
async function processAuthDeletions(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('pending_auth_deletions')
    .select('user_id, email, company_id, attempts')
    .order('created_at')
    .limit(500)
  if (error) return { deleted: [] as string[], failed: [{ email: '', error: error.message }] }

  const deleted: string[] = []
  const failed: { email: string; error: string }[] = []
  for (const row of (data ?? []) as PendingRow[]) {
    const { error: delError } = await admin.auth.admin.deleteUser(row.user_id)
    const notFound = !!delError && (delError.status === 404 || /not.?found/i.test(delError.message ?? ''))
    if (!delError || notFound) {
      await admin.from('pending_auth_deletions').delete().eq('user_id', row.user_id)
      deleted.push(row.email)
    } else {
      await admin
        .from('pending_auth_deletions')
        .update({ attempts: row.attempts + 1, last_error: delError.message })
        .eq('user_id', row.user_id)
      failed.push({ email: row.email, error: delError.message })
    }
  }
  return { deleted, failed }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Método não suportado.')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) return fail(500, 'misconfigured', 'Função sem configuração do Supabase.')

  const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  const admin = createClient(supabaseUrl, serviceKey, clientOptions)

  // 1. Quem pede tem de ser Super Admin.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return fail(401, 'not_authenticated', 'Inicie sessão para continuar.')
  const { data: callerData, error: callerError } = await admin.auth.getUser(jwt)
  if (callerError || !callerData.user) return fail(401, 'not_authenticated', 'Sessão inválida ou expirada.')
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('id', callerData.user.id)
    .maybeSingle()
  if (!callerProfile?.is_super_admin) {
    return fail(403, 'forbidden', 'Apenas o Super Admin do Sistema pode eliminar empresas.')
  }

  let body: { companyId?: string; confirmName?: string }
  try {
    body = await req.json()
  } catch {
    return fail(400, 'validation', 'Pedido inválido.')
  }
  if (!body.companyId || !body.confirmName?.trim()) {
    return fail(400, 'validation', 'Indique a empresa e escreva o nome dela para confirmar.')
  }

  // 2. Eliminação dos dados, com a sessão do Super Admin (a base de dados valida tudo de novo).
  const asCaller = createClient(supabaseUrl, anonKey, {
    ...clientOptions,
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  })
  const { data: result, error: rpcError } = await asCaller.rpc('admin_delete_company', {
    p_company_id: body.companyId,
    p_confirm_name: body.confirmName
  })
  if (rpcError) {
    const status = rpcError.hint === 'forbidden' ? 403 : rpcError.hint === 'not_found' ? 404 : 400
    return fail(status, rpcError.hint || 'db_error', rpcError.message)
  }

  // 3. Ficheiros e 4. contas Auth (a empresa já não existe: falhas aqui não revertem os dados).
  const storage = await removeCompanyFiles(admin, body.companyId)
  const auth = await processAuthDeletions(admin)

  await admin.from('platform_admin_logs').insert({
    actor_id: callerData.user.id,
    actor_email: callerData.user.email ?? '',
    action: 'company.deletion_cleanup',
    target_type: 'company',
    target_id: body.companyId,
    target_name: result.companyName,
    details: {
      storageFilesRemoved: storage.removed,
      storageError: storage.error,
      authAccountsDeleted: auth.deleted.length,
      authAccountsFailed: auth.failed
    }
  })

  return reply(200, {
    ok: true,
    companyId: result.companyId,
    companyName: result.companyName,
    deleted: result.deleted,
    authAccountsDeleted: auth.deleted.length,
    authAccountsPending: auth.failed,
    storageFilesRemoved: storage.removed,
    storageError: storage.error
  })
})
