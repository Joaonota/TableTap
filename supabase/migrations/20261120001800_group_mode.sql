-- =====================================================================
-- TapMenu — 1800 · Modo Grupo: conta individual e colectiva numa só sessão
--
-- Extensão da arquitectura existente (não é um sistema paralelo):
--   - table_sessions        uma sessão activa por mesa (já existia)
--   - session_participants  um participante por telemóvel, com token secreto
--                           (já existia) + avatar, saída e revogação
--   - orders.participant_id quem fez o pedido (já existia)
--   - payments              passa a poder liquidar ITENS de vários pedidos
--                           da sessão (order_id opcional, table_session_id,
--                           participant_id = quem paga, split_mode)
--   - payment_allocations   NOVA — quanto de cada item cada pagamento cobre
--
-- Conta (calculada sempre no servidor, a partir dos pedidos e pagamentos):
--   devido do item   = preço do item + parte proporcional das taxas do pedido
--                      (o último item do pedido absorve o arredondamento,
--                      por isso a soma dos itens = total do pedido)
--   pago             = alocações de pagamentos confirmados/pagos
--                      (ou o pedido inteiro, se foi pago pelo fluxo antigo)
--   reservado        = alocações de pagamentos a aguardar confirmação
--   em aberto        = devido - pago - reservado  (nunca negativo)
--
-- Integridade:
--   - create_session_payment bloqueia a sessão (FOR UPDATE): dois telemóveis
--     a pagar ao mesmo tempo são serializados e nenhum item é cobrado duas vezes;
--   - a confirmação do pagamento (equipa) exige os pedidos entregues (1400);
--   - a sessão só fecha sem valores pendentes, excepto por acção de um
--     gerente com motivo, registada em audit_logs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Participantes: avatar, saída voluntária e revogação pela equipa
-- ---------------------------------------------------------------------
alter table public.session_participants
  add column if not exists avatar text check (avatar is null or avatar ~ '^[a-z]{3,12}$'),
  add column if not exists left_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by text;

-- ---------------------------------------------------------------------
-- 2. Pagamentos da conta dividida
-- ---------------------------------------------------------------------
alter table public.payments alter column order_id drop not null;
alter table public.payments
  add column if not exists table_session_id uuid references public.table_sessions (id) on delete set null,
  add column if not exists participant_id uuid references public.session_participants (id) on delete set null,
  add column if not exists split_mode text check (split_mode is null or split_mode in ('own', 'equal', 'items', 'all')),
  add column if not exists payer_name text,
  add column if not exists table_number text;
alter table public.payments drop constraint if exists payments_target;
alter table public.payments add constraint payments_target check (order_id is not null or table_session_id is not null);
create index if not exists payments_session_idx on public.payments (table_session_id);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  payment_id uuid not null references public.payments (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  table_session_id uuid not null references public.table_sessions (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, order_item_id)
);
create index if not exists payment_allocations_item_idx on public.payment_allocations (order_item_id);
create index if not exists payment_allocations_session_idx on public.payment_allocations (table_session_id);
create index if not exists payment_allocations_order_idx on public.payment_allocations (order_id);

alter table public.payment_allocations enable row level security;
drop policy if exists payment_allocations_select on public.payment_allocations;
create policy payment_allocations_select on public.payment_allocations for select to authenticated
  using (private.has_restaurant_access(restaurant_id));
revoke all on public.payment_allocations from anon, authenticated;
grant select on public.payment_allocations to authenticated;

-- Encerramento com valores em falta (só gerente, com motivo).
alter table public.table_sessions
  add column if not exists unpaid_at_close numeric(12, 2),
  add column if not exists forced_close_reason text;

-- ---------------------------------------------------------------------
-- 3. Linhas da conta (uma por item não cancelado da sessão)
-- ---------------------------------------------------------------------
create or replace function private.session_bill_lines(p_session_id uuid)
returns table (
  item_id uuid, order_id uuid, order_code text, order_status text, order_created_at timestamptz,
  participant_id uuid, product_name text, quantity integer, unit_price numeric, item_total numeric,
  due numeric, paid numeric, reserved numeric, outstanding numeric, sort_order integer)
language sql
stable
security definer
set search_path = ''
as $$
  with items as (
    select i.id, i.order_id, o.order_code, o.status, o.created_at, o.participant_id, i.product_name, i.quantity,
           i.unit_price, i.total_price, i.sort_order, o.payment_status, o.total as order_total, o.subtotal as order_subtotal,
           case when o.subtotal > 0 then round((o.total - o.subtotal) * i.total_price / o.subtotal, 2) else 0 end as extra,
           row_number() over (partition by i.order_id order by i.sort_order desc, i.id desc) as rn_desc
    from public.order_items i
    join public.orders o on o.id = i.order_id
    where o.table_session_id = p_session_id
      and o.status <> 'cancelled'
      and o.payment_status <> 'refunded'
  ),
  dues as (
    select it.*,
           it.total_price + case when it.rn_desc = 1
             then it.order_total - it.order_subtotal - (sum(it.extra) over (partition by it.order_id) - it.extra)
             else it.extra end as due
    from items it
  ),
  alloc as (
    select a.order_item_id,
           sum(a.amount) filter (where p.status in ('paid', 'confirmed')) as paid,
           sum(a.amount) filter (where p.status in ('pending', 'awaiting_confirmation')) as reserved
    from public.payment_allocations a
    join public.payments p on p.id = a.payment_id
    where a.table_session_id = p_session_id
    group by a.order_item_id
  )
  select d.id, d.order_id, d.order_code, d.status, d.created_at, d.participant_id, d.product_name, d.quantity,
         d.unit_price, d.total_price, d.due,
         x.paid_amt, x.reserved_amt, greatest(d.due - x.paid_amt - x.reserved_amt, 0), d.sort_order
  from dues d
  left join alloc a on a.order_item_id = d.id
  cross join lateral (
    select
      -- Pedido pago pelo fluxo antigo (botão "Pago" em Pedidos): o item está pago.
      case when d.payment_status in ('paid', 'confirmed') then d.due else least(coalesce(a.paid, 0), d.due) end as paid_amt,
      case when d.payment_status in ('paid', 'confirmed') then 0
           when d.payment_status = 'awaiting_confirmation' and coalesce(a.reserved, 0) = 0 and coalesce(a.paid, 0) = 0
             then d.due  -- pagamento antigo, por pedido, a aguardar confirmação
           else least(coalesce(a.reserved, 0), greatest(d.due - coalesce(a.paid, 0), 0)) end as reserved_amt
  ) x
$$;

/** Participantes activos (não saíram nem foram revogados). */
create or replace function private.active_participants(p_session_id uuid)
returns setof public.session_participants
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.session_participants
  where session_id = p_session_id and left_at is null and revoked_at is null
  order by joined_at
$$;

-- ---------------------------------------------------------------------
-- 4. Quem pode agir na sessão (participante activo ou equipa)
-- ---------------------------------------------------------------------
create or replace function private.assert_session_actor(p_session public.table_sessions, p_token uuid)
returns public.session_participants
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_participant public.session_participants;
begin
  if p_token is not null then
    select * into v_participant from public.session_participants
    where session_id = p_session.id and token = p_token and left_at is null and revoked_at is null;
    if found then
      return v_participant;
    end if;
  end if;
  if private.has_restaurant_access(p_session.restaurant_id) then
    return null;
  end if;
  raise exception 'Junte-se à sessão desta mesa para continuar.' using errcode = '42501', hint = 'not_participant';
end;
$$;

/** Canal Realtime: participantes revogados deixam de receber eventos. */
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
      and p.revoked_at is null
      and (s.status = 'active' or s.closed_at > now() - interval '12 hours'));
end;
$$;

-- Só os participantes activos aparecem na sessão (um dispositivo revogado ou
-- que saiu deixa de ser reconhecido e não volta a entrar com o mesmo token).
create or replace function private.session_json(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'tenantId', s.company_id,
    'restaurantId', s.restaurant_id,
    'tableId', s.table_id,
    'status', s.status,
    'startedAt', s.started_at,
    'closedAt', s.closed_at,
    'closedBy', s.closed_by,
    'cancelReason', s.cancel_reason,
    'primaryCustomerName', s.primary_customer_name,
    'partySize', s.party_size,
    'notes', s.notes,
    'total', s.total,
    'billRequestedAt', s.bill_requested_at,
    'unpaidAtClose', s.unpaid_at_close,
    'forcedCloseReason', s.forced_close_reason,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'joinedAt', p.joined_at, 'isPrimary', p.is_primary,
                                          'avatar', p.avatar) order by p.joined_at)
      from public.session_participants p
      where p.session_id = s.id and p.left_at is null and p.revoked_at is null), '[]'::jsonb),
    'orderIds', coalesce((
      select jsonb_agg(o.id order by o.created_at) from public.orders o where o.table_session_id = s.id), '[]'::jsonb)
  )
  from public.table_sessions s
  where s.id = p_session_id
$$;

create or replace function private.participant_json(p public.session_participants)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'joinedAt', p.joined_at, 'isPrimary', p.is_primary,
                            'avatar', p.avatar, 'token', p.token)
$$;

create or replace function private.clean_avatar(p_avatar text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when lower(trim(coalesce(p_avatar, ''))) ~ '^[a-z]{3,12}$' then lower(trim(p_avatar)) end
$$;

-- Pedido: identifica o participante (painel, cozinha, atendimento).
create or replace function private.order_json(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'tenantId', o.company_id,
    'restaurantId', o.restaurant_id,
    'tableId', o.table_id,
    'tableNumber', o.table_number,
    'tableSessionId', o.table_session_id,
    'participantId', o.participant_id,
    'participantName', (select p.name from public.session_participants p where p.id = o.participant_id),
    'isAdditional', o.is_additional,
    'orderCode', o.order_code,
    'type', o.type,
    'status', o.status,
    'paymentStatus', o.payment_status,
    'paymentMethod', o.payment_method,
    'subtotal', o.subtotal,
    'taxAmount', o.tax_amount,
    'serviceFee', o.service_fee,
    'total', o.total,
    'customerName', o.customer_name,
    'customerPhone', o.customer_phone,
    'notes', o.notes,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'productId', i.product_id, 'productName', i.product_name, 'productImage', i.product_image,
        'quantity', i.quantity, 'unitPrice', i.unit_price, 'totalPrice', i.total_price,
        'selectedVariant', i.selected_variant, 'selectedAddons', i.selected_addons,
        'removedIngredients', to_jsonb(i.removed_ingredients), 'notes', i.notes, 'station', i.station) order by i.sort_order)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.status, 'timestamp', h.created_at, 'updatedBy', h.updated_by, 'note', h.note) order by h.created_at)
      from public.order_status_history h where h.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_order_id
$$;

-- ---------------------------------------------------------------------
-- 5. Entrada na sessão (com avatar opcional)
-- ---------------------------------------------------------------------
drop function if exists public.join_table_session(uuid, text);
create or replace function public.join_table_session(p_session_id uuid, p_name text, p_avatar text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
  v_participant public.session_participants;
  v_name text := private.clean_participant_name(p_name);
  v_first boolean;
begin
  select * into v_session from public.table_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Sessão não encontrada.' using hint = 'session_not_found';
  end if;
  if v_session.status <> 'active' then
    raise exception 'Esta sessão já foi encerrada.' using hint = 'session_not_active';
  end if;
  -- O primeiro participante activo é o organizador.
  v_first := not exists (select 1 from private.active_participants(p_session_id));
  insert into public.session_participants (session_id, name, is_primary, avatar)
  values (p_session_id, v_name, v_first, private.clean_avatar(p_avatar))
  returning * into v_participant;
  if v_session.primary_customer_name is null then
    update public.table_sessions set primary_customer_name = v_name where id = p_session_id;
  end if;
  return jsonb_build_object('session', private.session_json(p_session_id), 'participant', private.participant_json(v_participant));
end;
$$;

/** Avatar escolhido depois de iniciar/entrar (o próprio participante). */
create or replace function public.update_participant_avatar(p_session_id uuid, p_participant_token uuid, p_avatar text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant public.session_participants;
begin
  update public.session_participants
  set avatar = private.clean_avatar(p_avatar)
  where session_id = p_session_id and token = p_participant_token and left_at is null and revoked_at is null
  returning * into v_participant;
  if not found then
    raise exception 'Junte-se à sessão desta mesa para continuar.' using errcode = '42501', hint = 'not_participant';
  end if;
  return private.participant_json(v_participant);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Conta da mesa (cliente: participante activo; equipa: tudo)
-- ---------------------------------------------------------------------
create or replace function private.session_bill_json(p_session_id uuid, p_me uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
  v_total numeric; v_paid numeric; v_reserved numeric; v_out numeric;
  v_remaining_payers integer;
  v_result jsonb;
begin
  select * into v_session from public.table_sessions where id = p_session_id;
  select coalesce(sum(due), 0), coalesce(sum(paid), 0), coalesce(sum(reserved), 0), coalesce(sum(outstanding), 0)
  into v_total, v_paid, v_reserved, v_out
  from private.session_bill_lines(p_session_id);

  -- Divisão igual: o que está em aberto a dividir pelos participantes que ainda não pagaram nada.
  select count(*) into v_remaining_payers
  from private.active_participants(p_session_id) ap
  where ap.id = p_me or not exists (
    select 1 from public.payments pay
    where pay.table_session_id = p_session_id and pay.participant_id = ap.id and pay.status not in ('failed', 'refunded'));

  select jsonb_build_object(
    'sessionId', v_session.id,
    'status', v_session.status,
    'meParticipantId', p_me,
    'totals', jsonb_build_object('total', v_total, 'paid', v_paid, 'reserved', v_reserved, 'outstanding', v_out,
                                 'pending', greatest(v_total - v_paid, 0)),
    'equalShare', case when v_out > 0 then round(v_out / greatest(v_remaining_payers, 1), 2) else 0 end,
    'equalPayers', greatest(v_remaining_payers, 1),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sp.id, 'name', sp.name, 'avatar', sp.avatar, 'isPrimary', sp.is_primary,
        'active', sp.left_at is null and sp.revoked_at is null,
        'isMe', sp.id = p_me,
        'consumption', coalesce(c.due, 0), 'paid', coalesce(c.paid, 0), 'reserved', coalesce(c.reserved, 0),
        'pending', greatest(coalesce(c.due, 0) - coalesce(c.paid, 0), 0),
        'outstanding', coalesce(c.outstanding, 0),
        'paidByMe', coalesce((select sum(pay.amount) from public.payments pay
                              where pay.table_session_id = p_session_id and pay.participant_id = sp.id
                                and pay.status in ('paid', 'confirmed')), 0))
        order by sp.joined_at)
      from public.session_participants sp
      left join lateral (
        select sum(l.due) as due, sum(l.paid) as paid, sum(l.reserved) as reserved, sum(l.outstanding) as outstanding
        from private.session_bill_lines(p_session_id) l where l.participant_id = sp.id) c on true
      where sp.session_id = p_session_id
        and (sp.left_at is null and sp.revoked_at is null or coalesce(c.due, 0) > 0)), '[]'::jsonb),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'itemId', l.item_id, 'orderId', l.order_id, 'orderCode', l.order_code, 'orderStatus', l.order_status,
        'participantId', l.participant_id, 'productName', l.product_name, 'quantity', l.quantity,
        'unitPrice', l.unit_price, 'itemTotal', l.item_total, 'due', l.due, 'paid', l.paid,
        'reserved', l.reserved, 'outstanding', l.outstanding)
        order by l.order_created_at, l.sort_order)
      from private.session_bill_lines(p_session_id) l), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pay.id, 'participantId', pay.participant_id, 'payerName', pay.payer_name, 'amount', pay.amount,
        'method', pay.method, 'status', pay.status, 'splitMode', pay.split_mode, 'createdAt', pay.created_at,
        'isMine', pay.participant_id = p_me)
        order by pay.created_at)
      from public.payments pay
      where pay.table_session_id = p_session_id and pay.status <> 'failed'), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_session_bill(p_session_id uuid, p_participant_token uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
  v_participant public.session_participants;
begin
  select * into v_session from public.table_sessions where id = p_session_id;
  if not found then
    raise exception 'Sessão não encontrada.' using hint = 'session_not_found';
  end if;
  v_participant := private.assert_session_actor(v_session, p_participant_token);
  return private.session_bill_json(p_session_id, v_participant.id);
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Pagar: o meu consumo / dividir igualmente / seleccionar itens / tudo
-- ---------------------------------------------------------------------
create or replace function private.create_session_payment(
  p_session public.table_sessions,
  p_participant public.session_participants,
  p_mode text,
  p_method text,
  p_items jsonb default null,
  p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_target numeric;
  v_left numeric;
  v_total_out numeric;
  v_count integer;
  v_i integer := 0;
  v_amount numeric;
  v_sum numeric := 0;
  v_line record;
  v_req record;
  v_table public.dining_tables;
  v_label text;
begin
  if p_mode not in ('own', 'equal', 'items', 'all') then
    raise exception 'Forma de pagamento inválida.' using hint = 'invalid_split_mode';
  end if;
  if p_method not in ('mpesa', 'emola', 'card', 'cash') then
    raise exception 'Método de pagamento inválido.' using hint = 'invalid_payment_method';
  end if;
  select * into v_table from public.dining_tables where id = p_session.table_id;

  insert into public.payments (restaurant_id, order_id, table_session_id, participant_id, split_mode, payer_name, table_number,
                               amount, method, status, transaction_reference, notes)
  values (p_session.restaurant_id, null, p_session.id, p_participant.id, p_mode, p_participant.name, v_table.number,
          0, p_method, 'awaiting_confirmation', '', nullif(left(trim(coalesce(p_notes, '')), 300), ''))
  returning id into v_payment_id;

  create temporary table if not exists pg_temp.tm_lines (
    item_id uuid, order_id uuid, participant_id uuid, quantity integer, due numeric, outstanding numeric, rank integer
  ) on commit drop;
  truncate pg_temp.tm_lines;
  insert into pg_temp.tm_lines
  select l.item_id, l.order_id, l.participant_id, l.quantity, l.due, l.outstanding,
         row_number() over (order by l.outstanding desc, l.order_created_at, l.sort_order)
  from private.session_bill_lines(p_session.id) l
  where l.outstanding > 0;

  if p_mode = 'own' then
    for v_line in select * from pg_temp.tm_lines where participant_id = p_participant.id loop
      insert into public.payment_allocations (restaurant_id, payment_id, order_item_id, order_id, table_session_id, amount)
      values (p_session.restaurant_id, v_payment_id, v_line.item_id, v_line.order_id, p_session.id, v_line.outstanding);
      v_sum := v_sum + v_line.outstanding;
    end loop;

  elsif p_mode = 'all' then
    for v_line in select * from pg_temp.tm_lines loop
      insert into public.payment_allocations (restaurant_id, payment_id, order_item_id, order_id, table_session_id, amount)
      values (p_session.restaurant_id, v_payment_id, v_line.item_id, v_line.order_id, p_session.id, v_line.outstanding);
      v_sum := v_sum + v_line.outstanding;
    end loop;

  elsif p_mode = 'items' then
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
      raise exception 'Escolha os produtos que quer pagar.' using hint = 'items_required';
    end if;
    for v_req in
      select (e ->> 'itemId')::uuid as item_id, coalesce((e ->> 'quantity')::integer, 0) as qty
      from jsonb_array_elements(p_items) e
    loop
      select * into v_line from pg_temp.tm_lines where item_id = v_req.item_id;
      if not found then
        -- Item de outra sessão, cancelado ou já pago/reservado.
        raise exception 'Um dos produtos escolhidos já está pago ou não pertence a esta conta.' using hint = 'item_not_payable';
      end if;
      if v_req.qty < 1 or v_req.qty > v_line.quantity then
        raise exception 'Quantidade inválida.' using hint = 'invalid_quantity';
      end if;
      v_amount := least(v_line.outstanding,
                        case when v_req.qty = v_line.quantity then v_line.outstanding
                             else round(v_line.due * v_req.qty / v_line.quantity, 2) end);
      if v_amount <= 0 then
        raise exception 'Um dos produtos escolhidos já está pago.' using hint = 'item_not_payable';
      end if;
      insert into public.payment_allocations (restaurant_id, payment_id, order_item_id, order_id, table_session_id, amount)
      values (p_session.restaurant_id, v_payment_id, v_line.item_id, v_line.order_id, p_session.id, v_amount);
      v_sum := v_sum + v_amount;
    end loop;

  else -- equal
    v_target := (private.session_bill_json(p_session.id, p_participant.id) ->> 'equalShare')::numeric;
    select coalesce(sum(outstanding), 0), count(*) into v_total_out, v_count from pg_temp.tm_lines;
    if v_target > 0 and v_total_out > 0 then
      -- Distribuição proporcional pelo que está em aberto; o último item absorve o arredondamento.
      v_left := v_target;
      for v_line in select * from pg_temp.tm_lines order by rank loop
        v_i := v_i + 1;
        v_amount := case when v_i = v_count then least(v_line.outstanding, v_left)
                         else least(v_line.outstanding, round(v_line.outstanding * v_target / v_total_out, 2), v_left) end;
        if v_amount > 0 then
          insert into public.payment_allocations (restaurant_id, payment_id, order_item_id, order_id, table_session_id, amount)
          values (p_session.restaurant_id, v_payment_id, v_line.item_id, v_line.order_id, p_session.id, v_amount);
          v_sum := v_sum + v_amount;
          v_left := v_left - v_amount;
        end if;
      end loop;
    end if;
  end if;

  if v_sum <= 0 then
    raise exception 'Não há valores por pagar nesta opção.' using hint = 'nothing_to_pay';
  end if;

  -- Salvaguarda: nenhum item pode ficar cobrado acima do devido.
  if exists (
    select 1
    from private.session_bill_lines(p_session.id) l
    join (select a.order_item_id, sum(a.amount) as amt
          from public.payment_allocations a join public.payments p on p.id = a.payment_id
          where a.table_session_id = p_session.id and p.status in ('pending', 'awaiting_confirmation', 'paid', 'confirmed')
          group by a.order_item_id) x on x.order_item_id = l.item_id
    where x.amt > l.due + 0.005) then
    raise exception 'Este valor já está a ser pago por outra pessoa. Atualize a conta.' using hint = 'double_charge';
  end if;

  update public.payments set amount = v_sum where id = v_payment_id;
  update public.table_sessions set bill_requested_at = coalesce(bill_requested_at, now()) where id = p_session.id;

  v_label := case p_mode when 'own' then 'o seu consumo' when 'equal' then 'parte igual' when 'items' then 'produtos escolhidos'
                         else 'a conta toda' end;
  perform private.notify(p_session.restaurant_id, 'bill_requested', 'Pagamento a confirmar',
    format('Mesa %s — %s vai pagar %s (%s, %s).', v_table.number, p_participant.name, private.money(v_sum), v_label,
           case p_method when 'mpesa' then 'M-Pesa' when 'emola' then 'e-Mola' when 'card' then 'Cartão' else 'Numerário' end),
    v_table.id, v_table.number, p_session.id);

  perform private.broadcast_to_session(p_session.id, 'bill.updated', jsonb_build_object(
    'eventId', v_payment_id || ':created',
    'type', 'bill.updated',
    'sessionId', p_session.id,
    'occurredAt', now()));
  return v_payment_id;
end;
$$;

create or replace function public.create_session_payment(
  p_session_id uuid,
  p_participant_token uuid,
  p_mode text,
  p_method text,
  p_items jsonb default null,
  p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
  v_participant public.session_participants;
  v_payment_id uuid;
begin
  -- Serializa os pagamentos da mesma sessão (dois telemóveis ao mesmo tempo).
  select * into v_session from public.table_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Sessão não encontrada.' using hint = 'session_not_found';
  end if;
  if v_session.status <> 'active' then
    raise exception 'Esta sessão já foi encerrada.' using hint = 'session_not_active';
  end if;
  v_participant := private.assert_session_actor(v_session, p_participant_token);
  if v_participant.id is null then
    raise exception 'Só um participante da mesa pode pagar por aqui.' using errcode = '42501', hint = 'not_participant';
  end if;
  v_payment_id := private.create_session_payment(v_session, v_participant, p_mode, p_method, p_items, p_notes);
  return private.session_bill_json(p_session_id, v_participant.id) || jsonb_build_object('paymentId', v_payment_id);
end;
$$;

/** O cliente desiste de um pagamento seu ainda por confirmar (liberta os itens). */
create or replace function public.cancel_session_payment(p_payment_id uuid, p_participant_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_session public.table_sessions;
  v_participant public.session_participants;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found or v_payment.table_session_id is null then
    raise exception 'Pagamento não encontrado.' using hint = 'payment_not_found';
  end if;
  select * into v_session from public.table_sessions where id = v_payment.table_session_id for update;
  v_participant := private.assert_session_actor(v_session, p_participant_token);
  if v_participant.id is null or v_payment.participant_id is distinct from v_participant.id then
    raise exception 'Só pode cancelar os seus próprios pagamentos.' using errcode = '42501', hint = 'forbidden';
  end if;
  if v_payment.status not in ('pending', 'awaiting_confirmation') then
    raise exception 'Este pagamento já foi confirmado pela equipa.' using hint = 'payment_already_confirmed';
  end if;
  update public.payments set status = 'failed', notes = coalesce(notes || ' · ', '') || 'Cancelado pelo cliente'
  where id = p_payment_id;
  perform private.broadcast_to_session(v_session.id, 'bill.updated', jsonb_build_object(
    'eventId', p_payment_id || ':cancelled', 'type', 'bill.updated', 'sessionId', v_session.id, 'occurredAt', now()));
  return private.session_bill_json(v_session.id, v_participant.id);
end;
$$;

-- "Pedir a conta" (com método) = uma pessoa paga tudo; sem método = só avisar a equipa.
-- No Modo Grupo só o organizador chama a equipa para a conta.
create or replace function public.request_bill(
  p_session_id uuid, p_participant_token uuid default null, p_payment_method text default null, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
  v_participant public.session_participants;
  v_table public.dining_tables;
begin
  select * into v_session from public.table_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Sessão não encontrada.' using hint = 'session_not_found';
  end if;
  if v_session.status <> 'active' then
    raise exception 'Esta sessão já foi encerrada.' using hint = 'session_not_active';
  end if;
  v_participant := private.assert_session_actor(v_session, p_participant_token);
  if p_payment_method is not null and p_payment_method not in ('mpesa', 'emola', 'card', 'cash') then
    raise exception 'Método de pagamento inválido.' using hint = 'invalid_payment_method';
  end if;

  perform private.recalculate_session_total(p_session_id);

  if p_payment_method is not null and v_participant.id is not null then
    perform private.create_session_payment(v_session, v_participant, 'all', p_payment_method, null, p_notes);
    return private.session_json(p_session_id);
  end if;

  if v_participant.id is not null and not v_participant.is_primary then
    raise exception 'Só o organizador da mesa pode pedir a conta. Pode pagar a sua parte em "Conta".'
      using errcode = '42501', hint = 'organizer_only';
  end if;

  update public.table_sessions set bill_requested_at = now() where id = p_session_id returning * into v_session;
  select * into v_table from public.dining_tables where id = v_session.table_id;
  perform private.notify(v_session.restaurant_id, 'bill_requested', 'Pedido de Conta',
    format('Mesa %s (%s) pediu a conta — Total: %s%s', v_table.number,
           coalesce(v_participant.name, v_session.primary_customer_name, 'Cliente'), private.money(v_session.total),
           case when coalesce(trim(p_notes), '') <> '' then ' — Nota: ' || left(trim(p_notes), 200) else '' end),
    v_table.id, v_table.number, p_session_id);
  return private.session_json(p_session_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Sair da sessão / revogar participante
-- ---------------------------------------------------------------------
create or replace function public.leave_table_session(p_session_id uuid, p_participant_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
  v_participant public.session_participants;
  v_pending numeric;
  v_next uuid;
begin
  select * into v_session from public.table_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Sessão não encontrada.' using hint = 'session_not_found';
  end if;
  v_participant := private.assert_session_actor(v_session, p_participant_token);
  if v_participant.id is null then
    raise exception 'Junte-se à sessão desta mesa para continuar.' using errcode = '42501', hint = 'not_participant';
  end if;
  select coalesce(sum(l.due - l.paid), 0) into v_pending
  from private.session_bill_lines(p_session_id) l where l.participant_id = v_participant.id;
  if v_pending > 0.005 then
    raise exception 'Ainda tem % por pagar. Pague o seu consumo antes de sair.', private.money(v_pending)
      using hint = 'participant_has_pending';
  end if;
  update public.session_participants set left_at = now(), is_primary = false where id = v_participant.id;
  delete from public.push_subscriptions where participant_id = v_participant.id;
  -- O organizador passa a ser o participante activo mais antigo.
  if v_participant.is_primary then
    select id into v_next from private.active_participants(p_session_id) limit 1;
    if v_next is not null then
      update public.session_participants set is_primary = true where id = v_next;
    end if;
  end if;
  return private.session_json(p_session_id);
end;
$$;

/** A equipa retira um dispositivo da sessão (token deixa de funcionar). */
create or replace function public.revoke_session_participant(p_participant_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant public.session_participants;
  v_session public.table_sessions;
  v_next uuid;
begin
  select * into v_participant from public.session_participants where id = p_participant_id for update;
  if not found then
    raise exception 'Participante não encontrado.' using hint = 'participant_not_found';
  end if;
  select * into v_session from public.table_sessions where id = v_participant.session_id;
  if not private.has_restaurant_access(v_session.restaurant_id) then
    raise exception 'Sem permissão para gerir esta sessão.' using errcode = '42501', hint = 'forbidden';
  end if;
  if v_participant.revoked_at is null then
    update public.session_participants
    set revoked_at = now(), revoked_by = private.actor_name(), is_primary = false
    where id = p_participant_id;
    delete from public.push_subscriptions where participant_id = p_participant_id;
    if v_participant.is_primary then
      select id into v_next from private.active_participants(v_session.id) limit 1;
      if v_next is not null then
        update public.session_participants set is_primary = true where id = v_next;
      end if;
    end if;
    insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
    values (v_session.company_id, (select auth.uid()), private.actor_name(), 'session.participant_revoked',
            'Sessão ' || v_session.id || ': ' || v_participant.name,
            coalesce('Motivo: ' || nullif(trim(coalesce(p_reason, '')), ''), 'Retirado da sessão pela equipa.'));
  end if;
  return private.session_json(v_session.id);
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Fecho: sem valores pendentes, excepto gerente com motivo (registado)
-- ---------------------------------------------------------------------
create or replace function private.finish_session(p_session_id uuid, p_status text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.finish_session(p_session_id, p_status, p_reason, false);
end;
$$;

create or replace function private.finish_session(p_session_id uuid, p_status text, p_reason text, p_force boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
  v_table public.dining_tables;
  v_pending numeric := 0;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into v_session from public.table_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Sessão não encontrada.' using hint = 'session_not_found';
  end if;
  if not private.has_restaurant_access(v_session.restaurant_id) then
    raise exception 'Sem permissão para gerir esta sessão.' using errcode = '42501', hint = 'forbidden';
  end if;
  if v_session.status <> 'active' then
    raise exception 'Esta sessão já foi encerrada.' using hint = 'session_not_active';
  end if;

  if p_status = 'closed' then
    select coalesce(sum(due - paid), 0) into v_pending from private.session_bill_lines(p_session_id);
    if v_pending > 0.005 then
      if not coalesce(p_force, false) then
        raise exception 'A mesa ainda tem % por pagar.', private.money(v_pending)
          using hint = 'session_has_pending', detail = v_pending::text;
      end if;
      if not private.has_restaurant_access(v_session.restaurant_id, 30) then
        raise exception 'Só um gerente pode encerrar uma mesa com valores por pagar.' using errcode = '42501', hint = 'forbidden';
      end if;
      if v_reason is null or length(v_reason) < 5 then
        raise exception 'Indique o motivo para encerrar com valores por pagar.' using hint = 'reason_required';
      end if;
      select * into v_table from public.dining_tables where id = v_session.table_id;
      insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
      values (v_session.company_id, (select auth.uid()), private.actor_name(), 'session.force_closed',
              format('Mesa %s — sessão %s', v_table.number, v_session.id),
              format('Encerrada com %s por pagar. Motivo: %s', private.money(v_pending), left(v_reason, 300)));
    end if;
  end if;

  perform private.recalculate_session_total(p_session_id);
  update public.table_sessions
  set status = p_status, closed_at = now(), closed_by = private.actor_name(),
      cancel_reason = case when p_status = 'cancelled' then v_reason end,
      unpaid_at_close = case when p_status = 'closed' and v_pending > 0.005 then round(v_pending, 2) end,
      forced_close_reason = case when p_status = 'closed' and v_pending > 0.005 then left(v_reason, 300) end
  where id = p_session_id;
  update public.dining_tables set status = 'free', active_session_id = null
  where id = v_session.table_id and active_session_id = p_session_id;
  return private.session_json(p_session_id);
end;
$$;

drop function if exists public.close_table_session(uuid);
create or replace function public.close_table_session(p_session_id uuid, p_force boolean default false, p_reason text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.finish_session(p_session_id, 'closed', p_reason, p_force)
$$;

-- ---------------------------------------------------------------------
-- 10. Pagamentos ↔ pedidos (fluxo antigo por pedido + conta dividida)
-- ---------------------------------------------------------------------

/** BEFORE: regras da conta dividida (entregue antes de pago; reembolso só depois de pago). */
create or replace function private.guard_session_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if new.table_session_id is null or new.order_id is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status in ('paid', 'confirmed') and old.status not in ('paid', 'confirmed') then
      select o.order_code into v_code
      from public.payment_allocations a join public.orders o on o.id = a.order_id
      where a.payment_id = new.id and o.status <> 'delivered'
      order by o.created_at limit 1;
      if v_code is not null then
        raise exception 'Só pode confirmar o pagamento depois de o pedido % ser entregue na mesa.', v_code
          using errcode = 'P0001', hint = 'payment_before_delivery';
      end if;
    end if;
    if new.status = 'refunded' and old.status not in ('paid', 'confirmed') then
      raise exception 'Só pode reembolsar um pagamento já pago.' using errcode = 'P0001', hint = 'refund_before_paid';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_session_payment on public.payments;
create trigger guard_session_payment before update of status on public.payments
  for each row execute function private.guard_session_payment();

create or replace function private.sync_order_from_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
begin
  -- Fluxo antigo: um pagamento por pedido.
  if new.order_id is not null then
    if not exists (select 1 from public.orders o where o.id = new.order_id and o.restaurant_id = new.restaurant_id) then
      raise exception 'O pedido não pertence a este restaurante.' using hint = 'order_not_found';
    end if;
    update public.orders set payment_status = new.status, payment_method = new.method
    where id = new.order_id and (payment_status is distinct from new.status or payment_method is distinct from new.method);
    return new;
  end if;

  -- Conta dividida: o pedido fica "Pago" quando todos os seus itens estão pagos.
  if new.table_session_id is null then
    return new;
  end if;
  if not exists (select 1 from public.table_sessions s where s.id = new.table_session_id and s.restaurant_id = new.restaurant_id) then
    raise exception 'A sessão não pertence a este restaurante.' using hint = 'session_not_found';
  end if;
  if tg_op = 'INSERT' or new.status is not distinct from old.status then
    return new;
  end if;

  perform set_config('tapmenu.group_payment_sync', 'on', true);
  for v_order in
    select o.id, o.payment_status,
           (select coalesce(sum(l.due - l.paid), 0) from private.session_bill_lines(new.table_session_id) l where l.order_id = o.id) as unpaid
    from public.orders o
    where o.id in (select a.order_id from public.payment_allocations a where a.payment_id = new.id)
  loop
    if v_order.unpaid <= 0.005 and v_order.payment_status not in ('paid', 'confirmed') then
      update public.orders set payment_status = 'paid', payment_method = new.method where id = v_order.id;
    elsif v_order.unpaid > 0.005 and v_order.payment_status in ('paid', 'confirmed')
          and exists (select 1 from public.payment_allocations a where a.order_id = v_order.id) then
      -- Reembolso de um pagamento da conta dividida: o pedido volta a ter valores por pagar.
      update public.orders set payment_status = 'pending' where id = v_order.id;
    end if;
  end loop;
  perform set_config('tapmenu.group_payment_sync', 'off', true);

  if new.status in ('paid', 'confirmed') and old.status not in ('paid', 'confirmed') then
    perform private.broadcast_to_session(new.table_session_id, 'payment.confirmed', jsonb_build_object(
      'eventId', new.id || ':confirmed',
      'type', 'payment.confirmed',
      'sessionId', new.table_session_id,
      'participantId', new.participant_id,
      'amount', new.amount,
      'status', new.status,
      'occurredAt', now()));
  end if;
  return new;
end;
$$;

/** Pedido marcado como pago (fluxo antigo) → regista o pagamento do que falta. */
create or replace function private.sync_payment_from_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_allocated numeric;
begin
  -- Alterado pela própria conta dividida: o pagamento já existe.
  if current_setting('tapmenu.group_payment_sync', true) = 'on' then
    return new;
  end if;
  select id into v_payment_id from public.payments where order_id = new.id order by created_at desc limit 1;
  if v_payment_id is not null then
    update public.payments set status = new.payment_status
    where id = v_payment_id and status is distinct from new.payment_status;
  elsif new.payment_status in ('paid', 'confirmed', 'awaiting_confirmation') then
    select coalesce(sum(a.amount), 0) into v_allocated
    from public.payment_allocations a join public.payments p on p.id = a.payment_id
    where a.order_id = new.id and p.status in ('paid', 'confirmed');
    if new.total - v_allocated > 0.005 then
      insert into public.payments (restaurant_id, order_id, table_session_id, amount, method, status, transaction_reference, notes, table_number)
      values (new.restaurant_id, new.id, new.table_session_id, new.total - v_allocated, coalesce(new.payment_method, 'cash'),
              new.payment_status, '', 'Registado a partir do pedido ' || new.order_code, new.table_number);
    end if;
  end if;
  return new;
end;
$$;

/** 1400/1500 + não marcar "Pago" no pedido com a conta dividida a meio de um pagamento. */
create or replace function private.guard_payment_after_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status in ('paid', 'confirmed')
     and old.payment_status is distinct from new.payment_status
     and old.payment_status not in ('paid', 'confirmed')
     and new.status <> 'delivered' then
    raise exception 'Só pode marcar o pagamento como pago depois de o pedido % ser entregue na mesa.', new.order_code
      using errcode = 'P0001', hint = 'payment_before_delivery';
  end if;

  if new.payment_status = 'refunded'
     and old.payment_status is distinct from new.payment_status
     and old.payment_status not in ('paid', 'confirmed') then
    raise exception 'Só pode reembolsar o pedido % depois de o pagamento estar pago.', new.order_code
      using errcode = 'P0001', hint = 'refund_before_paid';
  end if;

  if new.payment_status in ('paid', 'confirmed')
     and old.payment_status is distinct from new.payment_status
     and coalesce(current_setting('tapmenu.group_payment_sync', true), 'off') <> 'on'
     and exists (select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id
                 where a.order_id = new.id and p.status in ('pending', 'awaiting_confirmation')) then
    raise exception 'O pedido % tem um pagamento da conta dividida a aguardar confirmação. Confirme-o em Pagamentos.', new.order_code
      using errcode = 'P0001', hint = 'group_payment_pending';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Notificações: pedidos identificados por participante
-- ---------------------------------------------------------------------
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
      'participantId', new.participant_id,
      'status', new.status,
      'previousStatus', old.status,
      'occurredAt', now()));
  end if;
  -- Pagos pela conta dividida: o aviso sai do próprio pagamento (um por pagamento).
  if new.payment_status is distinct from old.payment_status
     and new.payment_status in ('confirmed', 'paid')
     and old.payment_status not in ('confirmed', 'paid')
     and coalesce(current_setting('tapmenu.group_payment_sync', true), 'off') <> 'on' then
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

-- ---------------------------------------------------------------------
-- 12. Privilégios
-- ---------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on function private.can_receive_customer_topic(text) to anon;

revoke execute on function
  public.join_table_session(uuid, text, text),
  public.update_participant_avatar(uuid, uuid, text),
  public.get_session_bill(uuid, uuid),
  public.create_session_payment(uuid, uuid, text, text, jsonb, text),
  public.cancel_session_payment(uuid, uuid),
  public.leave_table_session(uuid, uuid),
  public.revoke_session_participant(uuid, text),
  public.close_table_session(uuid, boolean, text)
from public, anon;
grant execute on function
  public.join_table_session(uuid, text, text),
  public.update_participant_avatar(uuid, uuid, text),
  public.get_session_bill(uuid, uuid),
  public.create_session_payment(uuid, uuid, text, text, jsonb, text),
  public.cancel_session_payment(uuid, uuid),
  public.leave_table_session(uuid, uuid)
to anon, authenticated;
grant execute on function
  public.revoke_session_participant(uuid, text),
  public.close_table_session(uuid, boolean, text)
to authenticated;
