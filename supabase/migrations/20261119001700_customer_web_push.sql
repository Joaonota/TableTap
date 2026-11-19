-- =====================================================================
-- TapMenu — 1700 · Web Push para o CLIENTE (ecrã bloqueado / página fechada)
--
-- O Realtime (migração 1300) só funciona com a página aberta e visível.
-- Com o telemóvel bloqueado, o navegador suspende a página: só uma
-- notificação PUSH (enviada pelo servidor ao serviço do navegador —
-- Google FCM, Apple, Mozilla) chega ao dispositivo e toca o som do sistema.
--
--   1. O telemóvel do cliente autoriza as notificações e regista a sua
--      PushSubscription (register_push_subscription, autorizada pelo token
--      secreto do participante).
--   2. Os mesmos eventos da migração 1300 (broadcast_to_session) passam a
--      chamar também a Edge Function `send-customer-push` por pg_net
--      (assíncrono, só depois do COMMIT — nunca atrasa nem bloqueia a
--      operação da equipa).
--   3. A Edge Function envia o push (chaves VAPID) e apaga subscrições
--      expiradas.
--
-- Configuração (fora do repositório, uma vez por projeto — Vault):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-customer-push', 'tapmenu_push_url');
--   select vault.create_secret('<segredo aleatório>', 'tapmenu_push_secret');
-- Sem estes segredos, o push fica desligado e tudo o resto funciona igual.
-- =====================================================================

do $$
begin
  create extension if not exists pg_net;
exception when others then
  -- Ambientes sem pg_net (ex.: testes locais): o push fica desligado.
  raise notice 'TapMenu: pg_net indisponível (%). Web Push desligado.', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Subscrições (uma por dispositivo/navegador e participante)
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.session_participants (id) on delete cascade,
  session_id uuid not null references public.table_sessions (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) between 20 and 200),
  auth text not null check (length(auth) between 8 and 100),
  -- Página a abrir quando o cliente toca na notificação (a mesa).
  page_url text check (page_url is null or (page_url ~ '^https?://' and length(page_url) <= 500)),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_session_idx on public.push_subscriptions (session_id);

-- Só acessível pelas funções abaixo (security definer) e pela Edge Function (service role).
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

/** Regista (ou atualiza) a subscrição push deste dispositivo na sessão. */
create or replace function public.register_push_subscription(
  p_session_id uuid,
  p_participant_token uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_page_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_id uuid;
begin
  select p.id into v_participant_id
  from public.session_participants p
  join public.table_sessions s on s.id = p.session_id
  where p.session_id = p_session_id
    and p.token = p_participant_token
    and s.status = 'active';
  if v_participant_id is null then
    raise exception 'Sessão inválida ou já encerrada.' using errcode = 'P0001', hint = 'invalid_session';
  end if;

  insert into public.push_subscriptions (participant_id, session_id, endpoint, p256dh, auth, page_url)
  values (v_participant_id, p_session_id, p_endpoint, p_p256dh, p_auth, nullif(trim(p_page_url), ''))
  on conflict (endpoint) do update
    set participant_id = excluded.participant_id,
        session_id = excluded.session_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        page_url = excluded.page_url,
        created_at = now();
end;
$$;

/** Remove a subscrição deste dispositivo (o cliente desativou as notificações). */
create or replace function public.unregister_push_subscription(p_participant_token uuid, p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions ps
  using public.session_participants p
  where ps.participant_id = p.id
    and p.token = p_participant_token
    and ps.endpoint = p_endpoint;
$$;

revoke execute on function public.register_push_subscription(uuid, uuid, text, text, text, text) from public;
revoke execute on function public.unregister_push_subscription(uuid, text) from public;
grant execute on function public.register_push_subscription(uuid, uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.unregister_push_subscription(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Envio: pede à Edge Function o push para os dispositivos da sessão
-- ---------------------------------------------------------------------
create or replace function private.send_push_to_session(p_session_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if p_session_id is null
     or not exists (select 1 from public.push_subscriptions where session_id = p_session_id) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'tapmenu_push_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'tapmenu_push_secret' limit 1;
  if v_url is null or v_secret is null then
    return; -- Web Push ainda não configurado.
  end if;

  -- pg_net: o pedido HTTP só sai depois do COMMIT e não espera pela resposta.
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('sessionId', p_session_id, 'event', p_payload),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tapmenu-push-secret', v_secret),
    timeout_milliseconds := 5000
  );
exception when others then
  -- O push nunca pode impedir a operação da equipa.
  raise warning 'TapMenu: falha ao pedir o Web Push: %', sqlerrm;
end;
$$;

/** Igual à 1300 + Web Push para os dispositivos com a página fechada. */
create or replace function private.broadcast_to_session(p_session_id uuid, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
begin
  if p_session_id is null then
    return;
  end if;
  for v_token in select p.token from public.session_participants p where p.session_id = p_session_id loop
    begin
      perform realtime.send(p_payload, p_event, private.customer_topic(v_token), true);
    exception when others then
      -- A notificação nunca pode impedir a operação (ex.: Realtime indisponível).
      raise warning 'TapMenu: falha ao notificar o cliente (%): %', p_event, sqlerrm;
    end;
  end loop;

  -- O fim da sessão não gera notificação (tem o seu próprio ecrã) — limpa as subscrições.
  if p_event in ('session.closed', 'session.cancelled') then
    delete from public.push_subscriptions where session_id = p_session_id;
  else
    perform private.send_push_to_session(p_session_id, p_payload);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Privilégios
-- ---------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on function private.can_receive_customer_topic(text) to anon;
