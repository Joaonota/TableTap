-- =====================================================================
-- TapMenu — 1300 · Notificações em tempo real para o CLIENTE
--
-- O cliente não tem conta (role anon) e não pode ler as tabelas
-- (orders, table_sessions…). Por isso usa-se Broadcast PRIVADO do
-- Supabase Realtime, enviado pela própria base de dados:
--
--   alteração de estado (pedido, pagamento, atendimento, sessão)
--     → trigger AFTER UPDATE
--     → realtime.send(..., topic = 'customer:<token do participante>', private = true)
--     → cada telemóvel da sessão recebe no SEU canal.
--
-- Isolamento (RLS em realtime.messages):
--   - o canal de cada dispositivo é o token secreto do participante
--     (só esse dispositivo o conhece — nunca sai em session_json);
--   - só entra no canal quem apresenta um token válido de uma sessão
--     ativa ou encerrada há pouco (private.can_receive_customer_topic);
--   - os eventos de uma sessão só são enviados aos participantes dessa
--     sessão — nunca a outras mesas, estabelecimentos ou empresas;
--   - os clientes não podem enviar mensagens (sem política de INSERT).
--
-- A origem do evento é a própria alteração de estado (RPC ou UPDATE
-- direto): o funcionário não faz nenhuma operação extra. Uma falha do
-- Realtime nunca impede a alteração (erros só geram um aviso no log).
--
-- Cada evento leva um eventId determinístico (ex.: <pedido>:status:ready)
-- para o telemóvel ignorar duplicados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Canal do dispositivo e autorização
-- ---------------------------------------------------------------------
create or replace function private.customer_topic(p_token uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'customer:' || p_token::text
$$;

/** O canal pedido pertence a um participante de uma sessão ativa (ou encerrada há < 12 h)? */
create or replace function private.can_receive_customer_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token uuid;
begin
  if p_topic is null
     or p_topic !~ '^customer:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_token := substr(p_topic, 10)::uuid;
  return exists (
    select 1
    from public.session_participants p
    join public.table_sessions s on s.id = p.session_id
    where p.token = v_token
      and (s.status = 'active' or s.closed_at > now() - interval '12 hours'));
end;
$$;

-- Receber (SELECT) apenas no próprio canal; enviar (INSERT) não é permitido aos clientes.
drop policy if exists customer_topic_receive on realtime.messages;
create policy customer_topic_receive on realtime.messages
  for select to anon, authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.messages.topic = (select realtime.topic())
    and private.can_receive_customer_topic((select realtime.topic()))
  );

-- ---------------------------------------------------------------------
-- 2. Envio para todos os dispositivos de UMA sessão
-- ---------------------------------------------------------------------
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
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Origem dos eventos
-- ---------------------------------------------------------------------

/** Pedido: mudança de estado e pagamento confirmado. */
create or replace function private.notify_customer_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.table_session_id is null then
    return new;
  end if;
  if new.status is distinct from old.status then
    perform private.broadcast_to_session(new.table_session_id, 'order.status_changed', jsonb_build_object(
      'eventId', new.id || ':status:' || new.status,
      'type', 'order.status_changed',
      'sessionId', new.table_session_id,
      'orderId', new.id,
      'orderCode', new.order_code,
      'status', new.status,
      'previousStatus', old.status,
      'occurredAt', now()));
  end if;
  if new.payment_status is distinct from old.payment_status
     and new.payment_status in ('confirmed', 'paid')
     and old.payment_status not in ('confirmed', 'paid') then
    -- Um só aviso por sessão (a conta fecha vários pedidos de uma vez).
    perform private.broadcast_to_session(new.table_session_id, 'payment.confirmed', jsonb_build_object(
      'eventId', new.table_session_id || ':payment:confirmed',
      'type', 'payment.confirmed',
      'sessionId', new.table_session_id,
      'orderId', new.id,
      'orderCode', new.order_code,
      'status', new.payment_status,
      'occurredAt', now()));
  end if;
  return new;
end;
$$;

create trigger notify_customer_order_change
  after update of status, payment_status on public.orders
  for each row execute function private.notify_customer_order_change();

/** Sessão encerrada ou cancelada pela equipa. */
create or replace function private.notify_customer_session_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('closed', 'cancelled') then
    perform private.broadcast_to_session(new.id, 'session.' || new.status, jsonb_build_object(
      'eventId', new.id || ':session:' || new.status,
      'type', 'session.' || new.status,
      'sessionId', new.id,
      'status', new.status,
      'occurredAt', now()));
  end if;
  return new;
end;
$$;

create trigger notify_customer_session_change
  after update of status on public.table_sessions
  for each row execute function private.notify_customer_session_change();

/** Pedido de atendimento (chamar o garçom, água…): a equipa respondeu. */
create or replace function private.notify_customer_service_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.table_session_id is not null
     and new.status is distinct from old.status
     and new.status in ('in_progress', 'completed') then
    perform private.broadcast_to_session(new.table_session_id, 'service_request.status_changed', jsonb_build_object(
      'eventId', new.id || ':service:' || new.status,
      'type', 'service_request.status_changed',
      'sessionId', new.table_session_id,
      'serviceRequestId', new.id,
      'requestType', new.type,
      'status', new.status,
      'occurredAt', now()));
  end if;
  return new;
end;
$$;

create trigger notify_customer_service_request_change
  after update of status on public.service_requests
  for each row execute function private.notify_customer_service_request_change();

-- ---------------------------------------------------------------------
-- 4. Privilégios
-- ---------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
-- A política de realtime.messages é avaliada com o papel do cliente (anon).
grant execute on function private.can_receive_customer_topic(text) to anon;
