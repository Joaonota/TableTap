-- =====================================================================
-- Migração 2000 — Garçons responsáveis pelas mesas.
--
-- * Cada mesa pode ter um garçom principal e garçons de apoio
--   (public.table_staff_assignments). A responsabilidade é da MESA, não do
--   participante: o Modo Grupo, o NFC/QR e os pedidos não mudam.
-- * A atribuição usa public.staff_members (não auth.users): funciona para
--   funcionários sem conta nem smartphone — o gerente/caixa age por eles.
-- * Histórico de atribuições, transferências e fecho (table_assignment_events).
-- * Turnos: estado do funcionário (em serviço, fora, pausa, ausente).
-- * Chamadas de atendimento são encaminhadas automaticamente para o
--   responsável da mesa; recebido → em atendimento → concluído; outro
--   funcionário autorizado pode assumir.
-- * Tudo validado no servidor (RPC security definer + RLS). O frontend nunca
--   decide empresa, estabelecimento, mesa ou funcionário.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Turnos — estado do funcionário
-- ---------------------------------------------------------------------
alter table public.staff_members
  add column if not exists duty_status text not null default 'off_duty'
    check (duty_status in ('on_duty', 'off_duty', 'on_break', 'absent')),
  add column if not exists duty_status_at timestamptz;

-- ---------------------------------------------------------------------
-- 2. Atribuições de mesa
-- ---------------------------------------------------------------------
create table public.table_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid not null references public.dining_tables (id) on delete cascade,
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  role text not null default 'primary' check (role in ('primary', 'support')),
  active boolean not null default true,
  -- Atribuição temporária: deixa de valer a partir desta hora.
  expires_at timestamptz,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_by_name text not null default '',
  ended_at timestamptz,
  ended_by uuid references auth.users (id) on delete set null,
  ended_by_name text,
  end_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- No máximo um principal activo por mesa, e cada pessoa uma vez por mesa.
create unique index table_staff_assignments_one_primary
  on public.table_staff_assignments (table_id) where active and role = 'primary';
create unique index table_staff_assignments_one_per_staff
  on public.table_staff_assignments (table_id, staff_id) where active;
create index on public.table_staff_assignments (restaurant_id) where active;
create index on public.table_staff_assignments (staff_id) where active;

create trigger set_company_from_restaurant before insert or update of restaurant_id, company_id
  on public.table_staff_assignments for each row execute function private.set_company_from_restaurant();
create trigger touch_updated_at before update on public.table_staff_assignments
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. Histórico (nunca é apagado com a transferência)
-- ---------------------------------------------------------------------
create table public.table_assignment_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid references public.dining_tables (id) on delete cascade,
  table_number text not null default '',
  table_session_id uuid references public.table_sessions (id) on delete set null,
  event text not null check (event in (
    'assigned', 'removed', 'transferred', 'role_changed', 'expired',
    'request_taken', 'request_completed', 'session_closed')),
  staff_id uuid references public.staff_members (id) on delete set null,
  staff_name text,
  from_staff_id uuid references public.staff_members (id) on delete set null,
  from_staff_name text,
  role text,
  reason text,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_name text not null default '',
  created_at timestamptz not null default clock_timestamp()
);
create index on public.table_assignment_events (table_id, created_at desc);
create index on public.table_assignment_events (restaurant_id, created_at desc);

create trigger set_company_from_restaurant before insert or update of restaurant_id, company_id
  on public.table_assignment_events for each row execute function private.set_company_from_restaurant();

-- ---------------------------------------------------------------------
-- 4. Chamadas: responsável e "recebido"
-- ---------------------------------------------------------------------
alter table public.service_requests
  add column if not exists responsible_staff_id uuid references public.staff_members (id) on delete set null,
  add column if not exists responsible_name text,
  add column if not exists handled_by_staff_id uuid references public.staff_members (id) on delete set null,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by_name text;

-- =====================================================================
-- 5. Regras de acesso
-- =====================================================================

/** Ligação do utilizador atual a ESTE estabelecimento (ou nada). */
create or replace function private.my_staff_for_restaurant(p_restaurant_id uuid)
returns public.staff_members
language sql
stable
security definer
set search_path = ''
as $$
  select m.* from public.staff_members m
  join public.companies c on c.id = m.company_id
  join public.restaurants r on r.company_id = m.company_id
  where m.user_id = (select auth.uid()) and m.is_active and c.is_active
    and r.id = p_restaurant_id
    and (m.role = 'company_owner' or p_restaurant_id = any (m.restaurant_ids))
  limit 1
$$;

/**
 * Que mesas o utilizador vê na operação:
 *   'all'      — Super Admin, dono, administrador, gerente/supervisor, caixa;
 *   'assigned' — garçom (só as mesas que lhe estão atribuídas);
 *   null       — sem acesso (ex.: cozinha, outro estabelecimento).
 */
create or replace function private.table_scope(p_restaurant_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me public.staff_members;
begin
  if private.is_super_admin() then
    return 'all';
  end if;
  v_me := private.my_staff_for_restaurant(p_restaurant_id);
  if v_me.id is null then
    return null;
  end if;
  if private.role_rank(v_me.role) >= 30 or v_me.role = 'receptionist' then
    return 'all';
  end if;
  if v_me.role = 'waiter' then
    return 'assigned';
  end if;
  return null;
end;
$$;

/** Atribuição em vigor (activa e, se temporária, ainda dentro do prazo). */
create or replace function private.assignment_in_force(a public.table_staff_assignments)
returns boolean
language sql
stable
set search_path = ''
as $$
  select a.active and (a.expires_at is null or a.expires_at > now())
$$;

create or replace function private.can_view_table(p_restaurant_id uuid, p_table_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_scope text := private.table_scope(p_restaurant_id);
begin
  if v_scope = 'all' then
    return true;
  end if;
  if v_scope = 'assigned' then
    return exists (
      select 1 from public.table_staff_assignments a
      where a.table_id = p_table_id and a.restaurant_id = p_restaurant_id
        and a.staff_id = (private.my_staff_for_restaurant(p_restaurant_id)).id
        and a.active and (a.expires_at is null or a.expires_at > now()));
  end if;
  return false;
end;
$$;

/** O funcionário pode atender mesas deste estabelecimento (activo, com acesso, não cozinha). */
create or replace function private.staff_can_serve(p_staff public.staff_members, p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_staff.id is not null
     and p_staff.is_active
     and p_staff.role <> 'kitchen_staff'
     and exists (select 1 from public.restaurants r where r.id = p_restaurant_id and r.company_id = p_staff.company_id)
     and (p_staff.role = 'company_owner' or p_restaurant_id = any (p_staff.restaurant_ids))
$$;

/** Defesa em profundidade: a atribuição tem de ser coerente, venha de onde vier. */
create or replace function private.guard_table_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff_members;
begin
  if not exists (select 1 from public.dining_tables t where t.id = new.table_id and t.restaurant_id = new.restaurant_id) then
    raise exception 'A mesa não pertence a este estabelecimento.' using errcode = '42501', hint = 'table_not_found';
  end if;
  select * into v_staff from public.staff_members where id = new.staff_id;
  if new.active and not private.staff_can_serve(v_staff, new.restaurant_id) then
    raise exception 'Este funcionário não pode atender mesas deste estabelecimento.' using errcode = '42501', hint = 'invalid_staff';
  end if;
  return new;
end;
$$;
create trigger guard_table_assignment before insert or update of table_id, staff_id, restaurant_id, active
  on public.table_staff_assignments for each row execute function private.guard_table_assignment();

-- ---------------------------------------------------------------------
-- RLS — leitura conforme o âmbito; escrita só pelas funções abaixo.
-- ---------------------------------------------------------------------
alter table public.table_staff_assignments enable row level security;
alter table public.table_assignment_events enable row level security;

create policy table_staff_assignments_select on public.table_staff_assignments for select to authenticated
  using (private.can_view_table(restaurant_id, table_id));
create policy table_assignment_events_select on public.table_assignment_events for select to authenticated
  using (private.can_view_table(restaurant_id, table_id));

revoke all on public.table_staff_assignments, public.table_assignment_events from anon;
revoke insert, update, delete on public.table_staff_assignments, public.table_assignment_events from authenticated;
grant select on public.table_staff_assignments, public.table_assignment_events to authenticated;

-- As chamadas passam a mudar de estado só pela função handle_service_request
-- (que valida quem é responsável). A leitura não muda.
revoke update on public.service_requests from authenticated;

-- =====================================================================
-- 6. Funções internas
-- =====================================================================
create or replace function private.log_table_event(
  p_table public.dining_tables, p_event text, p_staff public.staff_members,
  p_from public.staff_members default null, p_role text default null, p_reason text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.table_assignment_events (
    restaurant_id, table_id, table_number, table_session_id, event,
    staff_id, staff_name, from_staff_id, from_staff_name, role, reason, actor_user_id, actor_name)
  values (
    p_table.restaurant_id, p_table.id, p_table.number, p_table.active_session_id, p_event,
    p_staff.id, p_staff.name, p_from.id, p_from.name, p_role,
    nullif(left(trim(coalesce(p_reason, '')), 300), ''),
    (select auth.uid()), case when (select auth.uid()) is null then 'Sistema' else private.actor_name() end);
$$;

create or replace function private.end_assignment(p_id uuid, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.table_staff_assignments
  set active = false, ended_at = now(), ended_by = (select auth.uid()),
      ended_by_name = case when (select auth.uid()) is null then 'Sistema' else private.actor_name() end,
      end_reason = nullif(left(trim(coalesce(p_reason, '')), 300), '')
  where id = p_id and active;
$$;

/** Fecha as atribuições temporárias que já passaram do prazo (e regista no histórico). */
create or replace function private.expire_table_assignments(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    update public.table_staff_assignments
    set active = false, ended_at = expires_at, ended_by_name = 'Sistema', end_reason = 'Atribuição temporária terminou'
    where restaurant_id = p_restaurant_id and active and expires_at is not null and expires_at <= now()
    returning table_id, staff_id, role
  loop
    perform private.log_table_event(
      (select t from public.dining_tables t where t.id = r.table_id), 'expired',
      (select m from public.staff_members m where m.id = r.staff_id), null, r.role, 'Atribuição temporária terminou');
  end loop;
end;
$$;

create or replace function private.load_staff(p_staff_id uuid, p_restaurant_id uuid)
returns public.staff_members
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.staff_members;
begin
  select * into v from public.staff_members where id = p_staff_id;
  if not private.staff_can_serve(v, p_restaurant_id) then
    raise exception 'Este funcionário não pode atender mesas deste estabelecimento.' using errcode = '42501', hint = 'invalid_staff';
  end if;
  return v;
end;
$$;

create or replace function private.load_table(p_table_id uuid)
returns public.dining_tables
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.dining_tables;
begin
  select * into v from public.dining_tables where id = p_table_id;
  if not found then
    raise exception 'Mesa não encontrada.' using hint = 'table_not_found';
  end if;
  return v;
end;
$$;

/**
 * Passa uma atribuição para outro funcionário, mantendo o papel
 * (principal → principal, apoio → apoio). Pedidos, sessão e pagamentos
 * não são tocados — só a responsabilidade muda.
 */
create or replace function private.move_assignment(
  p_assignment public.table_staff_assignments, p_to public.staff_members, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.dining_tables;
  v_from public.staff_members;
  v_existing public.table_staff_assignments;
begin
  select * into v_table from public.dining_tables where id = p_assignment.table_id;
  select * into v_from from public.staff_members where id = p_assignment.staff_id;

  perform private.end_assignment(p_assignment.id, coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Transferida para ' || p_to.name));

  select * into v_existing from public.table_staff_assignments
  where table_id = p_assignment.table_id and staff_id = p_to.id and active;
  if found then
    -- O destino já estava na mesa (ex.: apoio): sobe para o papel transferido.
    if p_assignment.role = 'primary' and v_existing.role <> 'primary' then
      update public.table_staff_assignments set role = 'primary', expires_at = null where id = v_existing.id;
    end if;
  else
    insert into public.table_staff_assignments (restaurant_id, table_id, staff_id, role, assigned_by, assigned_by_name)
    values (p_assignment.restaurant_id, p_assignment.table_id, p_to.id, p_assignment.role,
            (select auth.uid()), coalesce(private.actor_name(), ''));
  end if;

  perform private.log_table_event(v_table, 'transferred', p_to, v_from, p_assignment.role, p_reason);
end;
$$;

create or replace function private.assignment_json(a public.table_staff_assignments)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id, 'tableId', a.table_id, 'staffId', a.staff_id, 'staffName', m.name, 'role', a.role,
    'dutyStatus', m.duty_status, 'hasAccount', m.user_id is not null,
    'expiresAt', a.expires_at, 'assignedAt', a.assigned_at, 'assignedByName', a.assigned_by_name)
  from public.staff_members m where m.id = a.staff_id
$$;

-- =====================================================================
-- 7. Atribuir, remover, transferir
-- =====================================================================

/**
 * Atribui um funcionário a uma ou várias mesas (gerente/supervisor para cima).
 * Como principal, substitui o principal anterior (fica no histórico como
 * transferência). p_expires_at torna a atribuição temporária.
 */
create or replace function public.assign_table_staff(
  p_table_ids uuid[], p_staff_id uuid, p_role text default 'primary',
  p_expires_at timestamptz default null, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table_id uuid;
  v_table public.dining_tables;
  v_staff public.staff_members;
  v_existing public.table_staff_assignments;
  v_primary public.table_staff_assignments;
  v_count integer := 0;
begin
  if p_role not in ('primary', 'support') then
    raise exception 'Papel inválido.' using hint = 'invalid_role';
  end if;
  if p_table_ids is null or cardinality(p_table_ids) = 0 or cardinality(p_table_ids) > 200 then
    raise exception 'Escolha entre 1 e 200 mesas.' using hint = 'invalid_tables';
  end if;
  if p_expires_at is not null and (p_expires_at <= now() or p_expires_at > now() + interval '7 days') then
    raise exception 'A atribuição temporária tem de terminar nos próximos 7 dias.' using hint = 'invalid_expiry';
  end if;

  foreach v_table_id in array (select array_agg(distinct x) from unnest(p_table_ids) x)
  loop
    v_table := private.load_table(v_table_id);
    if not private.has_restaurant_access(v_table.restaurant_id, 30) then
      raise exception 'Só o gerente ou supervisor pode atribuir mesas.' using errcode = '42501', hint = 'forbidden';
    end if;
    if not v_table.is_active then
      raise exception 'A mesa % está desativada.', v_table.number using hint = 'table_inactive';
    end if;
    v_staff := private.load_staff(p_staff_id, v_table.restaurant_id);
    perform private.expire_table_assignments(v_table.restaurant_id);

    select * into v_existing from public.table_staff_assignments
    where table_id = v_table.id and staff_id = v_staff.id and active;

    if p_role = 'primary' then
      select * into v_primary from public.table_staff_assignments
      where table_id = v_table.id and role = 'primary' and active and staff_id <> v_staff.id;
      if v_primary.id is not null then
        -- Trocar o responsável: o anterior sai (ou passa a apoio se já não estiver).
        perform private.end_assignment(v_primary.id, coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Novo responsável: ' || v_staff.name));
        perform private.log_table_event(v_table, 'transferred', v_staff,
          (select m from public.staff_members m where m.id = v_primary.staff_id), 'primary', p_reason);
      end if;
    end if;

    if v_existing.id is not null then
      if v_existing.role <> p_role then
        update public.table_staff_assignments set role = p_role, expires_at = p_expires_at where id = v_existing.id;
        perform private.log_table_event(v_table, 'role_changed', v_staff, null, p_role, p_reason);
      else
        update public.table_staff_assignments set expires_at = p_expires_at where id = v_existing.id;
      end if;
    else
      insert into public.table_staff_assignments (restaurant_id, table_id, staff_id, role, expires_at, assigned_by, assigned_by_name)
      values (v_table.restaurant_id, v_table.id, v_staff.id, p_role, p_expires_at, (select auth.uid()), private.actor_name());
      if v_primary.id is null then
        perform private.log_table_event(v_table, 'assigned', v_staff, null, p_role,
          coalesce(p_reason, case when p_expires_at is not null then 'Temporária até ' || to_char(p_expires_at at time zone 'Africa/Maputo', 'HH24:MI') end));
      end if;
    end if;
    v_primary := null;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('assigned', v_count);
end;
$$;

create or replace function public.remove_table_staff(p_assignment_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.table_staff_assignments;
begin
  select * into v_a from public.table_staff_assignments where id = p_assignment_id and active;
  if not found then
    raise exception 'Atribuição não encontrada.' using hint = 'not_assigned';
  end if;
  if not private.has_restaurant_access(v_a.restaurant_id, 30) then
    raise exception 'Só o gerente ou supervisor pode remover atribuições.' using errcode = '42501', hint = 'forbidden';
  end if;
  perform private.end_assignment(v_a.id, coalesce(p_reason, 'Removida'));
  perform private.log_table_event(
    (select t from public.dining_tables t where t.id = v_a.table_id), 'removed',
    (select m from public.staff_members m where m.id = v_a.staff_id), null, v_a.role, p_reason);
  return jsonb_build_object('removed', true);
end;
$$;

/**
 * Transfere uma mesa para outro funcionário sem mexer nos pedidos, sessão
 * ou pagamentos. O gerente/supervisor transfere qualquer mesa; o garçom só
 * as suas. Sem p_from_staff_id, transfere o principal.
 */
create or replace function public.transfer_table(
  p_table_id uuid, p_to_staff_id uuid, p_reason text default null, p_from_staff_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.dining_tables;
  v_to public.staff_members;
  v_me public.staff_members;
  v_a public.table_staff_assignments;
  v_manager boolean;
begin
  v_table := private.load_table(p_table_id);
  if private.table_scope(v_table.restaurant_id) is null then
    raise exception 'Sem acesso a esta mesa.' using errcode = '42501', hint = 'forbidden';
  end if;
  perform private.expire_table_assignments(v_table.restaurant_id);
  v_manager := private.has_restaurant_access(v_table.restaurant_id, 30);
  v_me := private.my_staff_for_restaurant(v_table.restaurant_id);

  select * into v_a from public.table_staff_assignments
  where table_id = v_table.id and active
    and (case when p_from_staff_id is not null then staff_id = p_from_staff_id else role = 'primary' end);
  if not found then
    raise exception 'Esta mesa não tem esse responsável.' using hint = 'not_assigned';
  end if;
  if not v_manager and v_a.staff_id is distinct from v_me.id then
    raise exception 'Só pode transferir as suas mesas.' using errcode = '42501', hint = 'forbidden';
  end if;

  v_to := private.load_staff(p_to_staff_id, v_table.restaurant_id);
  if v_to.id = v_a.staff_id then
    raise exception 'A mesa já é deste funcionário.' using hint = 'same_staff';
  end if;
  perform private.move_assignment(v_a, v_to, p_reason);
  return jsonb_build_object('transferred', 1);
end;
$$;

/**
 * "Transferir minhas mesas" (fim de turno). O garçom transfere as suas;
 * o gerente/supervisor pode fazê-lo por outro funcionário (p_from_staff_id).
 * Não fecha sessões nem pedidos.
 */
create or replace function public.transfer_staff_tables(
  p_restaurant_id uuid, p_to_staff_id uuid, p_reason text default null, p_from_staff_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me public.staff_members;
  v_from_id uuid;
  v_to public.staff_members;
  v_a public.table_staff_assignments;
  v_count integer := 0;
begin
  if private.table_scope(p_restaurant_id) is null then
    raise exception 'Sem acesso a este estabelecimento.' using errcode = '42501', hint = 'forbidden';
  end if;
  v_me := private.my_staff_for_restaurant(p_restaurant_id);
  v_from_id := coalesce(p_from_staff_id, v_me.id);
  if v_from_id is null then
    raise exception 'Indique de quem são as mesas.' using hint = 'invalid_staff';
  end if;
  if v_from_id is distinct from v_me.id and not private.has_restaurant_access(p_restaurant_id, 30) then
    raise exception 'Só pode transferir as suas mesas.' using errcode = '42501', hint = 'forbidden';
  end if;
  v_to := private.load_staff(p_to_staff_id, p_restaurant_id);
  if v_to.id = v_from_id then
    raise exception 'Escolha outro funcionário.' using hint = 'same_staff';
  end if;
  perform private.expire_table_assignments(p_restaurant_id);

  for v_a in
    select * from public.table_staff_assignments
    where restaurant_id = p_restaurant_id and staff_id = v_from_id and active
    order by role, assigned_at
  loop
    perform private.move_assignment(v_a, v_to, coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Fim de turno'));
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('transferred', v_count);
end;
$$;

-- =====================================================================
-- 8. Turnos
-- =====================================================================
/**
 * Muda o estado de serviço. O próprio funcionário muda o seu; o gerente ou
 * supervisor muda o de quem trabalha nos seus estabelecimentos (útil para
 * quem não tem conta/smartphone). As mesas e sessões ficam como estão.
 */
create or replace function public.set_staff_duty_status(p_status text, p_staff_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.staff_members;
  v_me public.staff_members := private.my_membership();
  v_allowed boolean;
begin
  if p_status not in ('on_duty', 'off_duty', 'on_break', 'absent') then
    raise exception 'Estado inválido.' using hint = 'invalid_status';
  end if;
  select * into v_target from public.staff_members where id = coalesce(p_staff_id, v_me.id);
  if not found then
    raise exception 'Funcionário não encontrado.' using hint = 'invalid_staff';
  end if;
  -- coalesce: com NULL (sem ligação), a permissão é recusada, nunca "desconhecida".
  v_allowed := coalesce(v_target.id = v_me.id, false)
    or private.has_company_access(v_target.company_id, 40)
    or exists (
      select 1 from public.restaurants r
      where r.company_id = v_target.company_id
        and (v_target.role = 'company_owner' or r.id = any (v_target.restaurant_ids))
        and private.has_restaurant_access(r.id, 30));
  if not v_allowed or (v_target.role = 'company_owner' and v_target.id is distinct from v_me.id
                       and not private.has_company_access(v_target.company_id, 50)) then
    raise exception 'Sem permissão para mudar o estado deste funcionário.' using errcode = '42501', hint = 'forbidden';
  end if;

  -- Só muda o estado de serviço (papel e acessos intactos): o guard da equipa
  -- aceita a alteração feita por esta função, já validada acima.
  perform set_config('tapmenu.trusted', 'on', true);
  update public.staff_members set duty_status = p_status, duty_status_at = now()
  where id = v_target.id returning * into v_target;
  perform set_config('tapmenu.trusted', 'off', true);

  insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
  values (v_target.company_id, (select auth.uid()), private.actor_name(), 'staff.duty_changed', 'staff_member',
          format('%s: %s', v_target.name, p_status));

  return jsonb_build_object(
    'staffId', v_target.id, 'dutyStatus', v_target.duty_status, 'dutyStatusAt', v_target.duty_status_at,
    'openTables', (select count(*) from public.table_staff_assignments a where a.staff_id = v_target.id and a.active));
end;
$$;

-- Funcionário desativado ou sem acesso ao estabelecimento: as suas atribuições terminam.
create or replace function private.end_assignments_without_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select a.id, a.table_id, a.role from public.table_staff_assignments a
    where a.staff_id = new.id and a.active and not private.staff_can_serve(new, a.restaurant_id)
  loop
    perform private.end_assignment(r.id, 'Funcionário sem acesso a este estabelecimento');
    perform private.log_table_event((select t from public.dining_tables t where t.id = r.table_id), 'removed', new, null, r.role,
      'Funcionário sem acesso a este estabelecimento');
  end loop;
  return new;
end;
$$;
create trigger end_assignments_without_access after update of is_active, role, restaurant_ids on public.staff_members
  for each row execute function private.end_assignments_without_access();

-- Fecho da sessão: fica no histórico quem era o responsável. As atribuições
-- continuam (são da mesa, não da sessão).
create or replace function private.log_session_closed_for_table()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff_members;
begin
  if new.status in ('closed', 'cancelled') and old.status = 'active' then
    select m.* into v_staff from public.table_staff_assignments a
    join public.staff_members m on m.id = a.staff_id
    where a.table_id = new.table_id and a.active and a.role = 'primary'
    limit 1;
    if v_staff.id is not null then
      insert into public.table_assignment_events (
        restaurant_id, table_id, table_number, table_session_id, event, staff_id, staff_name, role, reason, actor_user_id, actor_name)
      select new.restaurant_id, t.id, t.number, new.id, 'session_closed', v_staff.id, v_staff.name, 'primary',
             nullif(coalesce(new.cancel_reason, ''), ''), (select auth.uid()), coalesce(new.closed_by, private.actor_name())
      from public.dining_tables t where t.id = new.table_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger log_session_closed_for_table after update of status on public.table_sessions
  for each row execute function private.log_session_closed_for_table();

-- =====================================================================
-- 9. Chamadas encaminhadas para o responsável da mesa
-- =====================================================================
create or replace function private.route_service_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff_members;
begin
  if new.table_id is not null and new.responsible_staff_id is null then
    select m.* into v_staff from public.table_staff_assignments a
    join public.staff_members m on m.id = a.staff_id
    where a.table_id = new.table_id and a.active and (a.expires_at is null or a.expires_at > now()) and m.is_active
    -- Principal primeiro; se estiver fora de serviço, um apoio em serviço.
    order by (a.role = 'primary' and m.duty_status in ('on_duty', 'off_duty')) desc,
             (m.duty_status = 'on_duty') desc, (a.role = 'primary') desc, a.assigned_at
    limit 1;
    if v_staff.id is not null then
      new.responsible_staff_id := v_staff.id;
      new.responsible_name := v_staff.name;
    end if;
  end if;
  return new;
end;
$$;
create trigger route_service_request before insert on public.service_requests
  for each row execute function private.route_service_request();

create or replace function private.service_request_json(r public.service_requests)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id, 'tenantId', r.company_id, 'restaurantId', r.restaurant_id, 'tableId', r.table_id,
    'tableNumber', r.table_number, 'tableSessionId', r.table_session_id, 'customerName', r.customer_name,
    'type', r.type, 'status', r.status, 'notes', r.notes, 'assignedToUserId', r.assigned_to_user_id,
    'assignedToName', r.assigned_to_name, 'createdAt', r.created_at, 'resolvedAt', r.resolved_at,
    'responsibleStaffId', r.responsible_staff_id, 'responsibleName', r.responsible_name,
    'handledByStaffId', r.handled_by_staff_id, 'acknowledgedAt', r.acknowledged_at,
    'acknowledgedByName', r.acknowledged_by_name)
$$;

/** Cliente chama a equipa (igual à 0300; a notificação indica o responsável). */
create or replace function public.create_service_request(
  p_table_id uuid, p_type text, p_session_id uuid default null, p_participant_token uuid default null,
  p_customer_name text default null, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.dining_tables;
  v_existing public.service_requests;
  v_request public.service_requests;
  v_label text;
begin
  select * into v_table from public.dining_tables where id = p_table_id;
  if not found or not v_table.is_active then
    raise exception 'Mesa não encontrada.' using hint = 'table_not_found';
  end if;
  if p_type not in ('waiter_call', 'water', 'cutlery', 'bill', 'general_help') then
    raise exception 'Tipo de pedido inválido.' using hint = 'invalid_type';
  end if;
  if p_session_id is not null and not exists (
    select 1 from public.table_sessions s where s.id = p_session_id and s.table_id = p_table_id and s.status = 'active') then
    raise exception 'A sessão desta mesa já foi encerrada.' using hint = 'session_not_active';
  end if;

  select * into v_existing from public.service_requests
  where table_id = p_table_id and type = p_type and status in ('new', 'in_progress')
  order by created_at desc limit 1;
  if found then
    return private.service_request_json(v_existing) || jsonb_build_object('alreadyExisted', true);
  end if;

  insert into public.service_requests (restaurant_id, table_id, table_number, table_session_id, customer_name, type, notes)
  values (v_table.restaurant_id, v_table.id, v_table.number, p_session_id,
          left(coalesce(nullif(trim(coalesce(p_customer_name, '')), ''), 'Cliente'), 60),
          p_type, nullif(left(trim(coalesce(p_notes, '')), 300), ''))
  returning * into v_request;

  v_label := case p_type when 'waiter_call' then 'Atendimento' when 'water' then 'Água'
                         when 'cutlery' then 'Talheres' when 'bill' then 'Conta' else 'Ajuda' end;
  perform private.notify(v_table.restaurant_id,
    case when p_type = 'waiter_call' then 'waiter_call' when p_type = 'bill' then 'bill_requested' else 'service_request' end,
    format('Mesa %s solicita atendimento', v_table.number),
    format('Responsável: %s · Motivo: %s%s',
           coalesce(v_request.responsible_name, 'sem responsável'), v_label,
           case when v_request.notes is not null then ' — ' || v_request.notes else '' end),
    v_table.id, v_table.number, p_session_id, null, v_request.id);

  return private.service_request_json(v_request) || jsonb_build_object('alreadyExisted', false);
end;
$$;

/**
 * A equipa trata uma chamada:
 *   acknowledge (recebido) · start (em atendimento) · complete (concluído)
 *   · cancel · take_over (assumir no lugar do responsável).
 * Pode agir: o responsável e os garçons da mesa, o gerente/supervisor, o
 * caixa. Outro garçom só assume se a chamada não tiver responsável, se o
 * responsável não estiver em serviço ou se esperar há 2 min sem "recebido".
 * O gerente pode registar a ação em nome de quem não tem conta (p_staff_id).
 */
create or replace function public.handle_service_request(
  p_request_id uuid, p_action text, p_staff_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.service_requests;
  v_scope text;
  v_me public.staff_members;
  v_actor public.staff_members;
  v_manager boolean;
  v_privileged boolean;
  v_is_team boolean;
  v_can_take boolean;
  v_responsible public.staff_members;
  v_name text;
begin
  if p_action not in ('acknowledge', 'start', 'complete', 'cancel', 'take_over') then
    raise exception 'Ação inválida.' using hint = 'invalid_action';
  end if;
  select * into v_r from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'Chamada não encontrada.' using hint = 'not_found';
  end if;
  v_scope := private.table_scope(v_r.restaurant_id);
  if v_scope is null then
    raise exception 'Sem acesso a esta chamada.' using errcode = '42501', hint = 'forbidden';
  end if;
  if v_r.status in ('completed', 'cancelled') then
    raise exception 'Esta chamada já foi encerrada.' using hint = 'request_closed';
  end if;

  v_manager := private.has_restaurant_access(v_r.restaurant_id, 30);
  v_me := private.my_staff_for_restaurant(v_r.restaurant_id);
  v_privileged := v_manager or coalesce(v_me.role = 'receptionist', false);

  if p_staff_id is not null and p_staff_id is distinct from v_me.id then
    if not v_privileged then
      raise exception 'Só o gerente ou o caixa regista ações por outro funcionário.' using errcode = '42501', hint = 'forbidden';
    end if;
    v_actor := private.load_staff(p_staff_id, v_r.restaurant_id);
  else
    v_actor := v_me;
  end if;

  -- Todas as condições com coalesce: NULL nunca pode conceder acesso.
  v_is_team := v_r.responsible_staff_id is null
    or coalesce(v_actor.id = v_r.responsible_staff_id, false)
    or coalesce(v_actor.id = v_r.handled_by_staff_id, false)
    or exists (select 1 from public.table_staff_assignments a
               where a.table_id = v_r.table_id and a.staff_id = v_actor.id and a.active
                 and (a.expires_at is null or a.expires_at > now()));
  select * into v_responsible from public.staff_members where id = v_r.responsible_staff_id;
  v_can_take := v_privileged or v_is_team
    or v_responsible.id is null
    or coalesce(not v_responsible.is_active, true)
    or coalesce(v_responsible.duty_status <> 'on_duty', true)
    or (v_r.acknowledged_at is null and v_r.created_at <= now() - interval '2 minutes');

  if not (v_privileged or v_is_team or v_can_take) then
    raise exception 'Esta chamada é de %. Pode assumi-la se não for atendida em 2 minutos.', v_r.responsible_name
      using errcode = '42501', hint = 'not_responsible';
  end if;
  if p_action = 'cancel' and not (v_privileged or v_is_team) then
    raise exception 'Só o responsável ou o gerente cancela esta chamada.' using errcode = '42501', hint = 'not_responsible';
  end if;

  v_name := coalesce(v_actor.name, private.actor_name());

  if p_action = 'acknowledge' then
    update public.service_requests
    set acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by_name = coalesce(acknowledged_by_name, v_name),
        handled_by_staff_id = coalesce(handled_by_staff_id, v_actor.id),
        assigned_to_user_id = coalesce(assigned_to_user_id, v_actor.user_id),
        assigned_to_name = coalesce(assigned_to_name, v_name)
    where id = v_r.id returning * into v_r;
  elsif p_action in ('start', 'take_over') then
    update public.service_requests
    set status = 'in_progress',
        acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by_name = coalesce(acknowledged_by_name, v_name),
        handled_by_staff_id = v_actor.id, assigned_to_user_id = v_actor.user_id, assigned_to_name = v_name
    where id = v_r.id returning * into v_r;
    if v_r.responsible_staff_id is distinct from v_actor.id and v_actor.id is not null and v_r.table_id is not null then
      perform private.log_table_event((select t from public.dining_tables t where t.id = v_r.table_id),
        'request_taken', v_actor, v_responsible, null, 'Chamada assumida');
    end if;
  elsif p_action = 'complete' then
    update public.service_requests
    set status = 'completed',
        acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by_name = coalesce(acknowledged_by_name, v_name),
        handled_by_staff_id = coalesce(handled_by_staff_id, v_actor.id),
        assigned_to_user_id = coalesce(assigned_to_user_id, v_actor.user_id),
        assigned_to_name = coalesce(assigned_to_name, v_name)
    where id = v_r.id returning * into v_r;
    if v_r.table_id is not null then
      perform private.log_table_event((select t from public.dining_tables t where t.id = v_r.table_id),
        'request_completed', coalesce((select m from public.staff_members m where m.id = v_r.handled_by_staff_id), v_actor),
        null, null, null);
    end if;
  else
    update public.service_requests set status = 'cancelled' where id = v_r.id returning * into v_r;
  end if;

  return private.service_request_json(v_r);
end;
$$;

-- =====================================================================
-- 10. Painel operacional
-- =====================================================================
/**
 * Mesas do estabelecimento com sessão, pedidos, chamadas, total e
 * responsáveis. O garçom recebe só as suas mesas (o servidor decide).
 */
create or replace function public.get_table_operations(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope text := private.table_scope(p_restaurant_id);
  v_me public.staff_members;
  v_tables jsonb;
  v_staff jsonb;
begin
  if v_scope is null then
    raise exception 'Sem acesso às mesas deste estabelecimento.' using errcode = '42501', hint = 'forbidden';
  end if;
  perform private.expire_table_assignments(p_restaurant_id);
  v_me := private.my_staff_for_restaurant(p_restaurant_id);

  select coalesce(jsonb_agg(row_json order by sort_area, sort_len, sort_number), '[]'::jsonb) into v_tables
  from (
    select lower(t.area) as sort_area, length(t.number) as sort_len, lower(t.number) as sort_number,
      jsonb_build_object(
        'id', t.id, 'number', t.number, 'name', t.name, 'area', t.area, 'capacity', t.capacity, 'status', t.status,
        'session', case when s.id is null then null else jsonb_build_object(
          'id', s.id, 'startedAt', s.started_at, 'customerName', s.primary_customer_name, 'partySize', s.party_size,
          'billRequestedAt', s.bill_requested_at,
          'participants', (select count(*) from public.session_participants p
                           where p.session_id = s.id and p.left_at is null and p.revoked_at is null)) end,
        'orders', coalesce((
          select jsonb_build_object(
            'count', count(*) filter (where o.status <> 'cancelled'),
            'received', count(*) filter (where o.status = 'received'),
            'confirmed', count(*) filter (where o.status = 'confirmed'),
            'preparing', count(*) filter (where o.status = 'preparing'),
            'ready', count(*) filter (where o.status = 'ready'),
            'delivered', count(*) filter (where o.status = 'delivered'),
            'unpaid', count(*) filter (where o.status <> 'cancelled' and o.payment_status not in ('paid', 'confirmed', 'refunded')),
            'total', coalesce(sum(o.total) filter (where o.status <> 'cancelled' and o.payment_status <> 'refunded'), 0),
            'oldestReadyAt', min(o.updated_at) filter (where o.status = 'ready'))
          from public.orders o where o.table_session_id = s.id), '{}'::jsonb),
        'requests', coalesce((
          select jsonb_agg(private.service_request_json(sr) order by sr.created_at)
          from public.service_requests sr
          where sr.table_id = t.id and sr.status in ('new', 'in_progress')), '[]'::jsonb),
        'assignments', coalesce((
          select jsonb_agg(private.assignment_json(a) order by a.role, a.assigned_at)
          from public.table_staff_assignments a where a.table_id = t.id and a.active), '[]'::jsonb)
      ) as row_json
    from public.dining_tables t
    left join public.table_sessions s on s.table_id = t.id and s.status = 'active'
    where t.restaurant_id = p_restaurant_id and t.is_active
      and (v_scope = 'all' or exists (
        select 1 from public.table_staff_assignments a
        where a.table_id = t.id and a.staff_id = v_me.id and a.active))
  ) x;

  -- Equipa que pode atender mesas aqui (para atribuir/transferir). Sem emails.
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'name', m.name, 'role', m.role, 'dutyStatus', m.duty_status, 'dutyStatusAt', m.duty_status_at,
      'hasAccount', m.user_id is not null,
      'tables', (select count(*) from public.table_staff_assignments a
                 where a.staff_id = m.id and a.active and a.restaurant_id = p_restaurant_id))
    order by (m.duty_status = 'on_duty') desc, m.name), '[]'::jsonb) into v_staff
  from public.staff_members m
  where private.staff_can_serve(m, p_restaurant_id);

  return jsonb_build_object(
    'tables', v_tables,
    'staff', v_staff,
    'me', jsonb_build_object(
      'staffId', v_me.id, 'name', coalesce(v_me.name, private.actor_name()), 'role', v_me.role,
      'dutyStatus', v_me.duty_status, 'scope', v_scope,
      'canManage', private.has_restaurant_access(p_restaurant_id, 30),
      'canActForOthers', private.has_restaurant_access(p_restaurant_id, 30) or coalesce(v_me.role = 'receptionist', false)),
    'serverTime', now());
end;
$$;

/** Histórico de uma mesa (atribuições, transferências, chamadas assumidas, fechos). */
create or replace function public.get_table_assignment_history(p_table_id uuid, p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.dining_tables := private.load_table(p_table_id);
begin
  if not private.can_view_table(v_table.restaurant_id, v_table.id) then
    raise exception 'Sem acesso a esta mesa.' using errcode = '42501', hint = 'forbidden';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'event', e.event, 'staffId', e.staff_id, 'staffName', e.staff_name,
      'fromStaffId', e.from_staff_id, 'fromStaffName', e.from_staff_name, 'role', e.role,
      'reason', e.reason, 'actorName', e.actor_name, 'sessionId', e.table_session_id, 'createdAt', e.created_at)
      order by e.created_at desc)
    from (select * from public.table_assignment_events
          where table_id = v_table.id order by created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) e
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- Realtime: o painel actualiza quando muda uma atribuição.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.table_staff_assignments;

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------
revoke execute on function public.assign_table_staff(uuid[], uuid, text, timestamptz, text) from public, anon;
revoke execute on function public.remove_table_staff(uuid, text) from public, anon;
revoke execute on function public.transfer_table(uuid, uuid, text, uuid) from public, anon;
revoke execute on function public.transfer_staff_tables(uuid, uuid, text, uuid) from public, anon;
revoke execute on function public.set_staff_duty_status(text, uuid) from public, anon;
revoke execute on function public.handle_service_request(uuid, text, uuid) from public, anon;
revoke execute on function public.get_table_operations(uuid) from public, anon;
revoke execute on function public.get_table_assignment_history(uuid, integer) from public, anon;
grant execute on function public.assign_table_staff(uuid[], uuid, text, timestamptz, text) to authenticated;
grant execute on function public.remove_table_staff(uuid, text) to authenticated;
grant execute on function public.transfer_table(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.transfer_staff_tables(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.set_staff_duty_status(text, uuid) to authenticated;
grant execute on function public.handle_service_request(uuid, text, uuid) to authenticated;
grant execute on function public.get_table_operations(uuid) to authenticated;
grant execute on function public.get_table_assignment_history(uuid, integer) to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on function private.can_receive_customer_topic(text) to anon;
