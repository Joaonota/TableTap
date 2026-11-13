-- =====================================================================
-- TapMenu — 0300 · Regras de negócio na base de dados
--
-- Erros de negócio: `raise exception ... using hint = '<codigo>'`.
-- O frontend converte o hint em DomainError(code, message).
-- Funções em `public` são chamáveis via supabase.rpc(); as internas ficam
-- em `private`.
-- =====================================================================

/** Contexto de confiança para operações internas (ex.: registo da empresa). */
create or replace function private.is_trusted()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('tapmenu.trusted', true), '') = 'on'
$$;

-- O guard da equipa aceita operações feitas por funções internas.
create or replace function private.guard_staff_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.staff_members;
  my_rank integer;
begin
  new.email := lower(trim(new.email));
  if private.is_super_admin() or private.is_trusted() then
    return new;
  end if;

  me := private.my_membership();
  my_rank := private.role_rank(me.role);

  if private.role_rank(new.role) > my_rank
     or (tg_op = 'UPDATE' and private.role_rank(old.role) > my_rank) then
    raise exception 'Não tem permissão para atribuir ou alterar este papel.' using errcode = '42501', hint = 'forbidden';
  end if;

  if me.role <> 'company_owner'
     and exists (select 1 from unnest(new.restaurant_ids) rid where not (rid = any (me.restaurant_ids))) then
    raise exception 'Só pode atribuir restaurantes a que tem acesso.' using errcode = '42501', hint = 'forbidden';
  end if;

  if exists (
    select 1 from unnest(new.restaurant_ids) rid
    where not exists (select 1 from public.restaurants r where r.id = rid and r.company_id = new.company_id)
  ) then
    raise exception 'Restaurante atribuído não pertence a esta empresa.' using hint = 'invalid_restaurant';
  end if;

  if tg_op = 'UPDATE' and new.user_id = (select auth.uid()) and (new.role <> old.role or not new.is_active) then
    raise exception 'Não pode alterar o seu próprio papel nem desativar a sua conta.' using errcode = '42501', hint = 'forbidden';
  end if;
  return new;
end;
$$;

-- =====================================================================
-- PLANOS E LIMITES
-- =====================================================================

/** Plano efetivo: subscrição da empresa → plano por omissão da plataforma. */
create or replace function private.effective_plan(p_company_id uuid)
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.plans p
  where p.id = coalesce(
    (select s.plan_id from public.subscriptions s where s.company_id = p_company_id),
    (select c.default_plan_id from public.platform_config c where c.id)
  )
$$;

/** Limite do plano (null = ilimitado; limite não definido = ilimitado). */
create or replace function private.plan_limit(p_company_id uuid, p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (l ->> 'limit')::integer
  from jsonb_array_elements((private.effective_plan(p_company_id)).limits) l
  where l ->> 'resourceKey' = p_key
  limit 1
$$;

create or replace function private.count_usage(p_company_id uuid, p_key text, p_restaurant_id uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case p_key
    when 'TABLES' then (select count(*) from public.dining_tables t where t.restaurant_id = p_restaurant_id)
    when 'PRODUCTS' then (select count(*) from public.products p where p.restaurant_id = p_restaurant_id)
    when 'CATEGORIES' then (select count(*) from public.categories c where c.restaurant_id = p_restaurant_id)
    when 'STAFF' then (select count(*) from public.staff_members m where m.company_id = p_company_id and m.is_active)
    when 'RESTAURANTS' then (select count(*) from public.restaurants r where r.company_id = p_company_id)
    when 'ORDERS_PER_MONTH' then (
      select count(*) from public.orders o
      where o.restaurant_id = p_restaurant_id and o.created_at >= date_trunc('month', now())
    )
    else 0
  end::integer
$$;

create or replace function private.assert_plan_limit(p_company_id uuid, p_key text, p_restaurant_id uuid default null)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := private.plan_limit(p_company_id, p_key);
  v_current integer;
  v_unit text;
  v_plan text;
begin
  if v_limit is null then
    return;
  end if;
  v_current := private.count_usage(p_company_id, p_key, p_restaurant_id);
  if v_current < v_limit then
    return;
  end if;
  v_unit := case p_key
    when 'TABLES' then 'mesas' when 'PRODUCTS' then 'produtos' when 'CATEGORIES' then 'categorias'
    when 'STAFF' then 'utilizadores' when 'RESTAURANTS' then 'restaurantes' else lower(p_key) end;
  v_plan := (private.effective_plan(p_company_id)).name;
  raise exception '%', format(
    'Limite do plano atingido: %s de %s %s%s (plano %s). Para adicionar mais %s, é necessário um plano com um limite superior.',
    v_current, v_limit, v_unit,
    case when p_key in ('TABLES', 'PRODUCTS', 'CATEGORIES') then ' neste restaurante' else '' end,
    v_plan, v_unit)
    using hint = 'plan_limit_reached';
end;
$$;

create or replace function private.enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := tg_argv[0];
begin
  if tg_table_name = 'staff_members' then
    if not new.is_active or (tg_op = 'UPDATE' and old.is_active) then
      return new;
    end if;
    perform private.assert_plan_limit(new.company_id, v_key);
  elsif tg_table_name = 'restaurants' then
    perform private.assert_plan_limit(new.company_id, v_key);
  else
    perform private.assert_plan_limit((select r.company_id from public.restaurants r where r.id = new.restaurant_id), v_key, new.restaurant_id);
  end if;
  return new;
end;
$$;

create trigger enforce_plan_limit before insert on public.dining_tables for each row execute function private.enforce_plan_limit('TABLES');
create trigger enforce_plan_limit before insert on public.products for each row execute function private.enforce_plan_limit('PRODUCTS');
create trigger enforce_plan_limit before insert on public.categories for each row execute function private.enforce_plan_limit('CATEGORIES');
create trigger enforce_plan_limit before insert on public.restaurants for each row execute function private.enforce_plan_limit('RESTAURANTS');
create trigger enforce_plan_limit before insert or update of is_active on public.staff_members for each row execute function private.enforce_plan_limit('STAFF');

/** Plano efetivo da empresa (para o frontend aplicar limites e funcionalidades). */
create or replace function public.get_company_plan(p_company_id uuid)
returns public.plans
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_company_access(p_company_id) then
    raise exception 'Sem acesso a esta empresa.' using errcode = '42501', hint = 'forbidden';
  end if;
  return private.effective_plan(p_company_id);
end;
$$;

create or replace function public.get_plan_usage(p_company_id uuid, p_key text, p_restaurant_id uuid default null)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_company_access(p_company_id) then
    raise exception 'Sem acesso a esta empresa.' using errcode = '42501', hint = 'forbidden';
  end if;
  return private.count_usage(p_company_id, p_key, p_restaurant_id);
end;
$$;

-- Um plano atribuído a empresas não pode ser eliminado.
create or replace function private.guard_plan_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.subscriptions s where s.plan_id = old.id;
  if v_count > 0 then
    raise exception '%', format('O plano "%s" está atribuído a %s empresa(s). Mude essas empresas de plano ou desative-o em vez de o eliminar.', old.name, v_count)
      using hint = 'plan_in_use';
  end if;
  return old;
end;
$$;

create trigger guard_plan_delete before delete on public.plans for each row execute function private.guard_plan_delete();

-- =====================================================================
-- SLUGS (empresa, restaurante, mesa)
-- =====================================================================
create or replace function private.unique_slug(p_base text, p_table text, p_scope_column text default null, p_scope_value uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text := coalesce(nullif(private.slugify(p_base), ''), 'item');
  v_slug text := v_base;
  v_i integer := 2;
  v_exists boolean;
begin
  loop
    if p_scope_column is null then
      execute format('select exists (select 1 from public.%I where slug = $1)', p_table) into v_exists using v_slug;
    else
      execute format('select exists (select 1 from public.%I where slug = $1 and %I = $2)', p_table, p_scope_column) into v_exists using v_slug, p_scope_value;
    end if;
    exit when not v_exists;
    v_slug := v_base || '-' || v_i;
    v_i := v_i + 1;
  end loop;
  return v_slug;
end;
$$;

create or replace function private.set_company_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.slug := private.unique_slug(coalesce(nullif(new.slug, ''), new.name), 'companies');
  return new;
end;
$$;
create trigger set_company_slug before insert on public.companies for each row execute function private.set_company_slug();

create or replace function private.set_restaurant_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is null or new.slug = '' or exists (select 1 from public.restaurants r where r.slug = new.slug) then
    new.slug := private.unique_slug(coalesce(nullif(new.slug, ''), new.name), 'restaurants');
  end if;
  return new;
end;
$$;
create trigger set_restaurant_slug before insert on public.restaurants for each row execute function private.set_restaurant_slug();

create or replace function private.create_restaurant_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.restaurant_counters (restaurant_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger create_restaurant_counter after insert on public.restaurants for each row execute function private.create_restaurant_counter();

-- O slug do restaurante faz parte das URLs gravadas nas etiquetas: imutável.
create or replace function private.guard_immutable_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'O identificador da URL não pode ser alterado (está gravado nas etiquetas NFC e QR Codes).' using hint = 'slug_immutable';
  end if;
  return new;
end;
$$;
create trigger guard_immutable_slug before update of slug on public.restaurants for each row execute function private.guard_immutable_slug();
create trigger guard_immutable_slug before update of slug on public.dining_tables for each row execute function private.guard_immutable_slug();

-- =====================================================================
-- MESAS
-- =====================================================================
create or replace function private.prepare_dining_table()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.number := trim(new.number);
  if new.number = '' then
    raise exception 'O número da mesa é obrigatório.' using hint = 'table_number_required';
  end if;
  if exists (
    select 1 from public.dining_tables t
    where t.restaurant_id = new.restaurant_id and lower(t.number) = lower(new.number) and t.id <> new.id
  ) then
    raise exception '%', format('Já existe uma mesa com o número %s.', new.number) using hint = 'table_number_taken';
  end if;
  if new.capacity is null or new.capacity < 1 or new.capacity > 50 then
    raise exception 'A capacidade deve ser um número inteiro entre 1 e 50.' using hint = 'table_capacity_invalid';
  end if;
  if coalesce(trim(new.name), '') = '' then
    new.name := 'Mesa ' || new.number;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'free';
    new.active_session_id := null;
    new.slug := private.unique_slug('mesa-' || coalesce(nullif(private.slugify(new.number), ''), 'sem-numero'),
                                    'dining_tables', 'restaurant_id', new.restaurant_id);
  elsif not new.is_active and old.is_active and old.status = 'occupied' then
    raise exception '%', format('Não é possível desativar a Mesa %s com uma sessão ativa.', old.number) using hint = 'table_has_session';
  end if;
  return new;
end;
$$;
create trigger prepare_dining_table before insert or update of number, name, capacity, is_active on public.dining_tables
  for each row execute function private.prepare_dining_table();

create or replace function private.tag_event(
  p_tag public.nfc_tags, p_type text, p_description text, p_actor text,
  p_table_id uuid default null, p_table_label text default null, p_path text default null,
  p_from text default null, p_to text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.nfc_tag_events (tag_id, restaurant_id, type, description, actor, table_id, table_label, path, from_status, to_status)
  values (p_tag.id, p_tag.restaurant_id, p_type, p_description, coalesce(p_actor, ''), p_table_id, p_table_label, p_path, p_from, p_to);
$$;

/** Estado de uma etiqueta (não desativada) depois de mudar a associação. */
create or replace function private.tag_status_after_association(p_configured_path text, p_target_path text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_configured_path is null then 'pending'
    when p_target_path is not null and p_configured_path = p_target_path then 'configured'
    else 'reassignment_pending'
  end
$$;

-- Remover uma mesa: recusa com sessão ativa; desassocia etiquetas com histórico.
create or replace function private.before_delete_dining_table()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag public.nfc_tags;
  v_new_status text;
begin
  if old.status = 'occupied' then
    raise exception '%', format('Não é possível remover a Mesa %s com uma sessão ativa.', old.number) using hint = 'table_has_session';
  end if;
  for v_tag in select * from public.nfc_tags where table_id = old.id loop
    v_new_status := case when v_tag.status = 'disabled' then 'disabled' else private.tag_status_after_association(v_tag.configured_path, null) end;
    update public.nfc_tags set table_id = null, target_path = null, status = v_new_status where id = v_tag.id;
    perform private.tag_event(v_tag, 'unassigned', format('Mesa %s removida. Associação removida.', old.number), private.actor_name(),
                              old.id, 'Mesa ' || old.number, null, v_tag.status, v_new_status);
  end loop;
  return old;
end;
$$;
create trigger before_delete_dining_table before delete on public.dining_tables for each row execute function private.before_delete_dining_table();

/** Livre ⇄ Indisponível. "Ocupada" só acontece através de uma sessão. */
create or replace function public.set_table_status(p_table_id uuid, p_status text)
returns public.dining_tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.dining_tables;
begin
  select * into v_table from public.dining_tables where id = p_table_id for update;
  if not found then
    raise exception 'Mesa não encontrada.' using hint = 'table_not_found';
  end if;
  if not private.has_restaurant_access(v_table.restaurant_id, 30) then
    raise exception 'Sem permissão para gerir esta mesa.' using errcode = '42501', hint = 'forbidden';
  end if;
  if p_status not in ('free', 'unavailable') then
    raise exception 'Estado inválido.' using hint = 'invalid_status';
  end if;
  if v_table.status = 'occupied' then
    raise exception '%', format('A Mesa %s tem uma sessão ativa. Encerre ou cancele a sessão primeiro.', v_table.number) using hint = 'table_has_session';
  end if;
  update public.dining_tables set status = p_status where id = p_table_id returning * into v_table;
  return v_table;
end;
$$;

-- =====================================================================
-- NOTIFICAÇÕES (criadas pelo servidor, nunca pelo cliente)
-- =====================================================================
create or replace function private.notify(
  p_restaurant_id uuid, p_type text, p_title text, p_message text,
  p_table_id uuid default null, p_table_number text default null, p_session_id uuid default null,
  p_order_id uuid default null, p_service_request_id uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (restaurant_id, type, title, message, table_id, table_number, table_session_id, order_id, service_request_id)
  values (p_restaurant_id, p_type, p_title, p_message, p_table_id, p_table_number, p_session_id, p_order_id, p_service_request_id);
$$;

-- =====================================================================
-- SESSÕES DE MESA
-- =====================================================================
create or replace function private.money(p_value numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(to_char(round(p_value, 2), 'FM999G999G990D00'), ',', ' ') || ' MT'
$$;

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
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'joinedAt', p.joined_at, 'isPrimary', p.is_primary) order by p.joined_at)
      from public.session_participants p where p.session_id = s.id), '[]'::jsonb),
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
  select jsonb_build_object('id', p.id, 'name', p.name, 'joinedAt', p.joined_at, 'isPrimary', p.is_primary, 'token', p.token)
$$;

create or replace function private.clean_participant_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_name = '' then
    raise exception 'Indique o seu nome.' using hint = 'participant_name_required';
  end if;
  if length(v_name) > 60 then
    raise exception 'O nome deve ter no máximo 60 caracteres.' using hint = 'participant_name_too_long';
  end if;
  return v_name;
end;
$$;

/** Recalcula o total da sessão a partir dos pedidos não cancelados. */
create or replace function private.recalculate_session_total(p_session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.table_sessions s
  set total = coalesce((select sum(o.total) from public.orders o where o.table_session_id = s.id and o.status <> 'cancelled'), 0)
  where s.id = p_session_id;
$$;

/**
 * Inicia uma sessão numa mesa livre (cliente via URL da mesa, ou equipa).
 * Devolve { session, participant } — o participant inclui o token secreto
 * que o dispositivo do cliente guarda para fazer pedidos.
 */
create or replace function public.start_table_session(
  p_table_id uuid, p_customer_name text default null, p_party_size integer default null, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.dining_tables;
  v_restaurant public.restaurants;
  v_session_id uuid;
  v_participant public.session_participants;
  v_is_staff boolean;
  v_name text;
begin
  select * into v_table from public.dining_tables where id = p_table_id for update;
  if not found then
    raise exception 'Mesa não encontrada.' using hint = 'table_not_found';
  end if;
  select * into v_restaurant from public.restaurants where id = v_table.restaurant_id;
  v_is_staff := private.has_restaurant_access(v_table.restaurant_id);

  if v_table.status = 'occupied' or exists (select 1 from public.table_sessions where table_id = v_table.id and status = 'active') then
    raise exception '%', format('A Mesa %s já tem uma sessão ativa.', v_table.number) using hint = 'table_already_occupied';
  end if;
  if not v_table.is_active or v_table.status <> 'free' or not v_restaurant.is_active
     or not (select c.is_active from public.companies c where c.id = v_restaurant.company_id) then
    raise exception '%', format('A Mesa %s está indisponível.', v_table.number) using hint = 'table_unavailable';
  end if;
  if p_party_size is not null and p_party_size < 1 then
    raise exception 'O número de pessoas deve ser pelo menos 1.' using hint = 'party_size_invalid';
  end if;

  v_name := case when v_is_staff and coalesce(trim(p_customer_name), '') = '' then null else private.clean_participant_name(p_customer_name) end;

  insert into public.table_sessions (restaurant_id, table_id, primary_customer_name, party_size, notes)
  values (v_table.restaurant_id, v_table.id, v_name, p_party_size, nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_session_id;

  if v_name is not null then
    insert into public.session_participants (session_id, name, is_primary) values (v_session_id, v_name, true)
    returning * into v_participant;
  end if;

  update public.dining_tables set status = 'occupied', active_session_id = v_session_id where id = v_table.id;

  perform private.notify(v_table.restaurant_id, 'table_occupied', 'Nova mesa ocupada',
    format('Mesa %s ocupada%s%s.', v_table.number,
           case when v_name is not null then ' por ' || v_name else '' end,
           case when p_party_size is not null then format(' (%s pessoas)', p_party_size) else '' end),
    v_table.id, v_table.number, v_session_id);

  return jsonb_build_object(
    'session', private.session_json(v_session_id),
    'participant', case when v_participant.id is null then null else private.participant_json(v_participant) end);
end;
$$;

/** Outro telemóvel junta-se à sessão ativa da mesa. */
create or replace function public.join_table_session(p_session_id uuid, p_name text)
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
  v_first := not exists (select 1 from public.session_participants where session_id = p_session_id);
  insert into public.session_participants (session_id, name, is_primary) values (p_session_id, v_name, v_first)
  returning * into v_participant;
  if v_session.primary_customer_name is null then
    update public.table_sessions set primary_customer_name = v_name where id = p_session_id;
  end if;
  return jsonb_build_object('session', private.session_json(p_session_id), 'participant', private.participant_json(v_participant));
end;
$$;

/** Verifica que quem chama participa na sessão (token) ou é da equipa. */
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
    select * into v_participant from public.session_participants where session_id = p_session.id and token = p_token;
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

create or replace function private.finish_session(p_session_id uuid, p_status text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
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
  perform private.recalculate_session_total(p_session_id);
  update public.table_sessions
  set status = p_status, closed_at = now(), closed_by = private.actor_name(),
      cancel_reason = case when p_status = 'cancelled' then nullif(trim(coalesce(p_reason, '')), '') end
  where id = p_session_id;
  update public.dining_tables set status = 'free', active_session_id = null
  where id = v_session.table_id and active_session_id = p_session_id;
  return private.session_json(p_session_id);
end;
$$;

create or replace function public.close_table_session(p_session_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.finish_session(p_session_id, 'closed', null)
$$;

create or replace function public.cancel_table_session(p_session_id uuid, p_reason text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.finish_session(p_session_id, 'cancelled', p_reason)
$$;

-- =====================================================================
-- PEDIDOS (preços calculados no servidor — nunca confiar no navegador)
-- =====================================================================
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

/**
 * Cria um pedido numa sessão de mesa.
 * p_items: [{ "productId": uuid, "quantity": int, "variantId"?: uuid,
 *            "addonIds"?: [uuid], "removedIngredients"?: [text], "notes"?: text }]
 */
create or replace function public.place_order(
  p_session_id uuid,
  p_participant_token uuid,
  p_items jsonb,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_notes text default null,
  p_payment_method text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
  v_participant public.session_participants;
  v_restaurant public.restaurants;
  v_table public.dining_tables;
  v_item jsonb;
  v_product public.products;
  v_variant public.product_variants;
  v_addons jsonb;
  v_addon_total numeric;
  v_unit numeric;
  v_qty integer;
  v_subtotal numeric := 0;
  v_tax numeric;
  v_fee numeric;
  v_number integer;
  v_order_id uuid;
  v_is_additional boolean;
  v_position integer := 0;
  v_customer text;
  v_item_count integer;
  v_is_staff boolean;
begin
  select * into v_session from public.table_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Sessão não encontrada.' using hint = 'session_not_found';
  end if;
  if v_session.status <> 'active' then
    raise exception 'A sessão desta mesa já foi encerrada. Atualize a página para iniciar uma nova.' using hint = 'session_not_active';
  end if;
  v_participant := private.assert_session_actor(v_session, p_participant_token);
  v_is_staff := v_participant.id is null;

  select * into v_restaurant from public.restaurants where id = v_session.restaurant_id;
  select * into v_table from public.dining_tables where id = v_session.table_id;
  if not v_is_staff and coalesce((v_restaurant.settings ->> 'allowCustomerOrdering')::boolean, true) = false then
    raise exception 'Este restaurante não aceita pedidos pelo menu digital.' using hint = 'ordering_disabled';
  end if;
  if p_payment_method is not null and p_payment_method not in ('mpesa', 'emola', 'card', 'cash') then
    raise exception 'Método de pagamento inválido.' using hint = 'invalid_payment_method';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O pedido não tem itens.' using hint = 'order_empty';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Demasiados itens num só pedido.' using hint = 'order_too_large';
  end if;

  update public.restaurant_counters set last_order_number = last_order_number + 1
  where restaurant_id = v_restaurant.id returning last_order_number into v_number;
  if v_number is null then
    insert into public.restaurant_counters (restaurant_id, last_order_number) values (v_restaurant.id, 1001)
    on conflict (restaurant_id) do update set last_order_number = public.restaurant_counters.last_order_number + 1
    returning last_order_number into v_number;
  end if;

  v_is_additional := exists (select 1 from public.orders where table_session_id = v_session.id);
  v_customer := coalesce(nullif(trim(coalesce(p_customer_name, '')), ''), v_participant.name, v_session.primary_customer_name, 'Cliente');

  insert into public.orders (restaurant_id, table_id, table_number, table_session_id, participant_id, is_additional,
                             order_number, order_code, type, payment_method, customer_name, customer_phone, notes)
  values (v_restaurant.id, v_table.id, v_table.number, v_session.id, v_participant.id, v_is_additional,
          v_number, '#ORD-' || v_number, 'dine_in', p_payment_method, left(v_customer, 60),
          nullif(trim(coalesce(p_customer_phone, '')), ''), nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 99 then
      raise exception 'Quantidade inválida.' using hint = 'invalid_quantity';
    end if;
    select * into v_product from public.products
    where id = private.try_uuid(v_item ->> 'productId') and restaurant_id = v_restaurant.id;
    if not found or not v_product.is_active then
      raise exception 'Um dos produtos já não existe no menu. Atualize a página.' using hint = 'product_not_found';
    end if;
    if not v_product.is_available then
      raise exception '%', format('%s não está disponível no momento.', v_product.name) using hint = 'product_unavailable';
    end if;

    v_variant := null;
    if coalesce(v_item ->> 'variantId', '') <> '' then
      select * into v_variant from public.product_variants
      where id = private.try_uuid(v_item ->> 'variantId') and product_id = v_product.id;
      if not found then
        raise exception '%', format('A opção escolhida para %s já não existe. Atualize a página.', v_product.name) using hint = 'variant_not_found';
      end if;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'price', a.price) order by a.sort_order), '[]'::jsonb),
           coalesce(sum(a.price), 0), count(*)
    into v_addons, v_addon_total, v_item_count
    from public.product_addons a
    where a.product_id = v_product.id
      and a.id in (select private.try_uuid(x) from jsonb_array_elements_text(coalesce(v_item -> 'addonIds', '[]'::jsonb)) x);
    if v_item_count <> jsonb_array_length(coalesce(v_item -> 'addonIds', '[]'::jsonb)) then
      raise exception '%', format('Um dos adicionais de %s já não existe. Atualize a página.', v_product.name) using hint = 'addon_not_found';
    end if;

    v_unit := coalesce(v_product.promotional_price, v_product.price) + coalesce(v_variant.price_delta, 0) + v_addon_total;
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_position := v_position + 1;

    insert into public.order_items (order_id, restaurant_id, product_id, product_name, product_image, quantity, unit_price,
                                    total_price, selected_variant, selected_addons, removed_ingredients, notes, station, sort_order)
    values (v_order_id, v_restaurant.id, v_product.id, v_product.name, nullif(v_product.image_url, ''), v_qty, v_unit,
            v_unit * v_qty,
            case when v_variant.id is null then null
                 else jsonb_build_object('id', v_variant.id, 'name', v_variant.name, 'priceDelta', v_variant.price_delta) end,
            v_addons,
            coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_item -> 'removedIngredients', '[]'::jsonb)) x
                      where x = any (v_product.removable_ingredients)), '{}'),
            nullif(left(trim(coalesce(v_item ->> 'notes', '')), 300), ''),
            v_product.station, v_position);
  end loop;

  v_tax := round(v_subtotal * v_restaurant.tax_rate / 100, 2);
  v_fee := round(v_subtotal * coalesce((v_restaurant.settings ->> 'serviceFeePercent')::numeric, 0) / 100, 2);
  update public.orders
  set subtotal = round(v_subtotal, 2), tax_amount = v_tax, service_fee = v_fee, total = round(v_subtotal, 2) + v_tax + v_fee
  where id = v_order_id;

  insert into public.order_status_history (order_id, restaurant_id, status, updated_by)
  values (v_order_id, v_restaurant.id, 'received', case when v_is_staff then private.actor_name() else v_customer end);

  perform private.recalculate_session_total(v_session.id);

  perform private.notify(v_restaurant.id,
    case when v_is_additional then 'additional_order' else 'new_order' end,
    case when v_is_additional then 'Pedido adicional recebido' else 'Novo pedido recebido' end,
    format('%s #ORD-%s — Mesa %s (%s) — %s %s — Total: %s',
           case when v_is_additional then 'Pedido adicional' else 'Pedido' end, v_number, v_table.number, v_customer,
           v_position, case when v_position = 1 then 'item' else 'itens' end,
           private.money(round(v_subtotal, 2) + v_tax + v_fee)),
    v_table.id, v_table.number, v_session.id, v_order_id);

  return private.order_json(v_order_id);
end;
$$;

/** Muda o estado de um pedido e regista o histórico. */
create or replace function public.update_order_status(p_order_id uuid, p_status text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado.' using hint = 'order_not_found';
  end if;
  if not private.has_restaurant_access(v_order.restaurant_id) then
    raise exception 'Sem permissão para gerir este pedido.' using errcode = '42501', hint = 'forbidden';
  end if;
  if p_status not in ('received', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled') then
    raise exception 'Estado inválido.' using hint = 'invalid_status';
  end if;
  update public.orders set status = p_status where id = p_order_id;
  insert into public.order_status_history (order_id, restaurant_id, status, updated_by, note)
  values (p_order_id, v_order.restaurant_id, p_status, private.actor_name(), nullif(trim(coalesce(p_note, '')), ''));
  if v_order.table_session_id is not null then
    perform private.recalculate_session_total(v_order.table_session_id);
  end if;
  return private.order_json(p_order_id);
end;
$$;

-- =====================================================================
-- PAGAMENTOS (registo e confirmação manual — sem gateway integrado)
-- O estado de pagamento do pedido acompanha o último pagamento.
-- =====================================================================
create or replace function private.sync_order_from_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.orders o where o.id = new.order_id and o.restaurant_id = new.restaurant_id) then
    raise exception 'O pedido não pertence a este restaurante.' using hint = 'order_not_found';
  end if;
  update public.orders set payment_status = new.status, payment_method = new.method
  where id = new.order_id and (payment_status is distinct from new.status or payment_method is distinct from new.method);
  return new;
end;
$$;
create trigger sync_order_from_payment after insert or update of status, method on public.payments
  for each row execute function private.sync_order_from_payment();

create or replace function private.sync_payment_from_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
begin
  select id into v_payment_id from public.payments where order_id = new.id order by created_at desc limit 1;
  if v_payment_id is not null then
    update public.payments set status = new.payment_status
    where id = v_payment_id and status is distinct from new.payment_status;
  elsif new.payment_status in ('paid', 'confirmed', 'awaiting_confirmation') then
    insert into public.payments (restaurant_id, order_id, amount, method, status, transaction_reference, notes)
    values (new.restaurant_id, new.id, new.total, coalesce(new.payment_method, 'cash'), new.payment_status, '',
            'Registado a partir do pedido ' || new.order_code);
  end if;
  return new;
end;
$$;
create trigger sync_payment_from_order after update of payment_status on public.orders
  for each row when (old.payment_status is distinct from new.payment_status)
  execute function private.sync_payment_from_order();

/**
 * O cliente pede a conta e indica como vai pagar. Os pedidos ainda por pagar
 * ficam "a aguardar confirmação" até a equipa confirmar o recebimento.
 */
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
  update public.table_sessions set bill_requested_at = now() where id = p_session_id returning * into v_session;

  if p_payment_method is not null then
    insert into public.payments (restaurant_id, order_id, amount, method, status, transaction_reference, notes)
    select o.restaurant_id, o.id, o.total, p_payment_method, 'awaiting_confirmation', '', 'Indicado pelo cliente ao pedir a conta'
    from public.orders o
    where o.table_session_id = p_session_id and o.status <> 'cancelled' and o.payment_status in ('pending', 'failed');
  end if;

  select * into v_table from public.dining_tables where id = v_session.table_id;
  perform private.notify(v_session.restaurant_id, 'bill_requested', 'Pedido de Conta',
    format('Mesa %s (%s) pediu a conta — Total: %s%s%s', v_table.number,
           coalesce(v_participant.name, v_session.primary_customer_name, 'Cliente'), private.money(v_session.total),
           case p_payment_method when 'mpesa' then ' — M-Pesa' when 'emola' then ' — e-Mola' when 'card' then ' — Cartão'
                                 when 'cash' then ' — Numerário' else '' end,
           case when coalesce(trim(p_notes), '') <> '' then ' — Nota: ' || left(trim(p_notes), 200) else '' end),
    v_table.id, v_table.number, p_session_id);
  return private.session_json(p_session_id);
end;
$$;

-- =====================================================================
-- SOLICITAÇÕES DE ATENDIMENTO
-- =====================================================================
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
    'assignedToName', r.assigned_to_name, 'createdAt', r.created_at, 'resolvedAt', r.resolved_at)
$$;

/** Cliente chama a equipa. Não duplica um pedido igual ainda em curso na mesma mesa. */
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

  v_label := case p_type when 'waiter_call' then 'Chamar empregado' when 'water' then 'Água'
                         when 'cutlery' then 'Talheres' when 'bill' then 'Conta' else 'Ajuda' end;
  perform private.notify(v_table.restaurant_id,
    case when p_type = 'waiter_call' then 'waiter_call' when p_type = 'bill' then 'bill_requested' else 'service_request' end,
    case when p_type = 'waiter_call' then 'Chamada de empregado' else 'Pedido de atendimento' end,
    format('Mesa %s (%s): %s%s', v_table.number, v_request.customer_name, v_label,
           case when v_request.notes is not null then ' — ' || v_request.notes else '' end),
    v_table.id, v_table.number, p_session_id, null, v_request.id);

  return private.service_request_json(v_request) || jsonb_build_object('alreadyExisted', false);
end;
$$;

create or replace function private.stamp_service_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('completed', 'cancelled') and old.status not in ('completed', 'cancelled') then
    new.resolved_at := now();
  elsif new.status in ('new', 'in_progress') then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;
create trigger stamp_service_request before update of status on public.service_requests
  for each row execute function private.stamp_service_request();

-- =====================================================================
-- ETIQUETAS NFC — registo administrativo (o TapMenu NÃO grava hardware)
-- Registo e configuração física: equipa TapMenu (Super Admin).
-- Associação, desassociação e desativação: gerente do restaurante ou TapMenu.
-- =====================================================================
create or replace function private.table_path(p_table_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select '/m/' || r.slug || '/' || t.slug
  from public.dining_tables t join public.restaurants r on r.id = t.restaurant_id
  where t.id = p_table_id
$$;

create or replace function private.lock_tag(p_tag_id uuid, p_min_rank integer)
returns public.nfc_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag public.nfc_tags;
begin
  select * into v_tag from public.nfc_tags where id = p_tag_id for update;
  if not found then
    raise exception 'Etiqueta não encontrada.' using hint = 'tag_not_found';
  end if;
  if p_min_rank > 50 then
    if not private.is_super_admin() then
      raise exception 'Esta operação é feita pela equipa TapMenu.' using errcode = '42501', hint = 'forbidden';
    end if;
  elsif not private.has_restaurant_access(v_tag.restaurant_id, p_min_rank) then
    raise exception 'Sem permissão para gerir esta etiqueta.' using errcode = '42501', hint = 'forbidden';
  end if;
  return v_tag;
end;
$$;

create or replace function private.tag_not_allowed(p_tag public.nfc_tags, p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', format('%s: %s (estado atual: %s).', p_tag.code, p_message,
    case p_tag.status when 'pending' then 'Pendente' when 'configured' then 'Configurada' when 'active' then 'Ativa'
                      when 'disabled' then 'Desativada' else 'Reatribuição pendente' end)
    using hint = 'tag_action_not_allowed';
end;
$$;

create or replace function public.nfc_register_tags(p_restaurant_id uuid, p_codes text[] default null, p_quantity integer default null, p_notes text default null)
returns setof public.nfc_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant public.restaurants;
  v_codes text[];
  v_invalid text[];
  v_taken text[];
  v_max integer;
  v_code text;
  v_tag public.nfc_tags;
begin
  if not private.is_super_admin() then
    raise exception 'O registo de etiquetas é feito pela equipa TapMenu.' using errcode = '42501', hint = 'forbidden';
  end if;
  select * into v_restaurant from public.restaurants where id = p_restaurant_id;
  if not found then
    raise exception 'Restaurante não encontrado.' using hint = 'restaurant_not_found';
  end if;

  select coalesce(array_agg(distinct upper(trim(c))), '{}') into v_codes
  from unnest(coalesce(p_codes, '{}')) c where trim(c) <> '';

  if cardinality(v_codes) = 0 then
    if p_quantity is null or p_quantity < 1 or p_quantity > 100 then
      raise exception 'Indique uma quantidade entre 1 e 100.' using hint = 'tag_quantity_invalid';
    end if;
    perform pg_advisory_xact_lock(hashtext('nfc_tag_codes'));
    select coalesce(max(substring(code from 5)::integer), 0) into v_max from public.nfc_tags;
    select array_agg('TAG-' || lpad((v_max + g)::text, 5, '0')) into v_codes from generate_series(1, p_quantity) g;
  else
    if cardinality(v_codes) <> (select count(*) from unnest(p_codes) c where trim(c) <> '') then
      raise exception 'Há códigos repetidos na lista.' using hint = 'tag_code_taken';
    end if;
  end if;

  select array_agg(c) into v_invalid from unnest(v_codes) c where c !~ '^TAG-[0-9]{5}$';
  if v_invalid is not null then
    raise exception '%', format('Código inválido: %s. Use o formato TAG-00017.', array_to_string(v_invalid, ', ')) using hint = 'tag_code_invalid';
  end if;
  select array_agg(code) into v_taken from public.nfc_tags where code = any (v_codes);
  if v_taken is not null then
    raise exception '%', format('Código já registado: %s.', array_to_string(v_taken, ', ')) using hint = 'tag_code_taken';
  end if;

  foreach v_code in array v_codes loop
    insert into public.nfc_tags (code, restaurant_id, notes)
    values (v_code, p_restaurant_id, nullif(trim(coalesce(p_notes, '')), ''))
    returning * into v_tag;
    perform private.tag_event(v_tag, 'registered', format('Etiqueta registada para %s.', v_restaurant.name), private.actor_name(),
                              null, null, null, null, 'pending');
    return next v_tag;
  end loop;
end;
$$;

create or replace function public.nfc_assign_tag(p_tag_id uuid, p_table_id uuid)
returns public.nfc_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag public.nfc_tags := private.lock_tag(p_tag_id, 30);
  v_table public.dining_tables;
  v_previous public.dining_tables;
  v_other text;
  v_path text;
  v_status text;
  v_rewrite boolean;
begin
  if v_tag.status = 'disabled' then
    perform private.tag_not_allowed(v_tag, 'reative a etiqueta antes de a associar');
  end if;
  select * into v_table from public.dining_tables where id = p_table_id;
  if not found then
    raise exception 'Mesa não encontrada.' using hint = 'table_not_found';
  end if;
  if v_table.restaurant_id <> v_tag.restaurant_id then
    raise exception 'A etiqueta e a mesa pertencem a restaurantes diferentes.' using hint = 'tag_wrong_restaurant';
  end if;
  if v_tag.table_id = v_table.id then
    return v_tag;
  end if;
  select code into v_other from public.nfc_tags where table_id = v_table.id and status <> 'disabled' and id <> v_tag.id;
  if v_other is not null then
    raise exception '%', format('A Mesa %s já tem a etiqueta %s. Desassocie-a primeiro.', v_table.number, v_other) using hint = 'table_has_tag';
  end if;

  if v_tag.table_id is not null then
    select * into v_previous from public.dining_tables where id = v_tag.table_id;
  end if;
  v_path := private.table_path(v_table.id);
  v_status := private.tag_status_after_association(v_tag.configured_path, v_path);
  v_rewrite := v_status = 'reassignment_pending';

  update public.nfc_tags set table_id = v_table.id, target_path = v_path, status = v_status where id = v_tag.id;
  perform private.tag_event(v_tag,
    case when v_previous.id is not null then 'association_changed' else 'associated' end,
    case when v_previous.id is not null
      then format('Associação alterada da Mesa %s para a Mesa %s.%s', v_previous.number, v_table.number,
                  case when v_rewrite then ' A etiqueta tem de ser regravada pela equipa TapMenu.' else '' end)
      else format('Associada à Mesa %s.%s', v_table.number,
                  case when v_rewrite then ' A URL gravada é de outra mesa — regravação necessária.' else '' end)
    end,
    private.actor_name(), v_table.id, 'Mesa ' || v_table.number, v_path, v_tag.status, v_status);
  select * into v_tag from public.nfc_tags where id = p_tag_id;
  return v_tag;
end;
$$;

create or replace function public.nfc_unassign_tag(p_tag_id uuid)
returns public.nfc_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag public.nfc_tags := private.lock_tag(p_tag_id, 30);
  v_table public.dining_tables;
  v_status text;
begin
  if v_tag.table_id is null or v_tag.status = 'disabled' then
    perform private.tag_not_allowed(v_tag, 'a etiqueta não tem mesa associada');
  end if;
  select * into v_table from public.dining_tables where id = v_tag.table_id;
  v_status := private.tag_status_after_association(v_tag.configured_path, null);
  update public.nfc_tags set table_id = null, target_path = null, status = v_status where id = v_tag.id;
  perform private.tag_event(v_tag, 'unassigned', format('Associação à %s removida.', coalesce('Mesa ' || v_table.number, 'mesa')),
                            private.actor_name(), v_table.id, 'Mesa ' || v_table.number, null, v_tag.status, v_status);
  select * into v_tag from public.nfc_tags where id = p_tag_id;
  return v_tag;
end;
$$;

/** A equipa TapMenu regista que gravou a URL da mesa com uma aplicação externa. */
create or replace function public.nfc_mark_tag_configured(p_tag_id uuid, p_notes text default null)
returns public.nfc_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag public.nfc_tags := private.lock_tag(p_tag_id, 99);
  v_actor text := private.actor_name();
begin
  if v_tag.table_id is null or v_tag.status not in ('pending', 'reassignment_pending') then
    perform private.tag_not_allowed(v_tag, 'não pode ser marcada como configurada');
  end if;
  update public.nfc_tags
  set configured_path = target_path, configured_at = now(), configured_by = v_actor, status = 'configured'
  where id = v_tag.id;
  perform private.tag_event(v_tag, 'configured',
    format('Configuração física registada: a equipa TapMenu indicou que gravou %s com uma aplicação externa.%s',
           v_tag.target_path, case when coalesce(trim(p_notes), '') <> '' then ' Nota: ' || trim(p_notes) else '' end),
    v_actor, v_tag.table_id, null, v_tag.target_path, v_tag.status, 'configured');
  select * into v_tag from public.nfc_tags where id = p_tag_id;
  return v_tag;
end;
$$;

create or replace function public.nfc_activate_tag(p_tag_id uuid)
returns public.nfc_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag public.nfc_tags := private.lock_tag(p_tag_id, 30);
begin
  if v_tag.status <> 'configured' then
    perform private.tag_not_allowed(v_tag, 'só etiquetas configuradas podem ser ativadas');
  end if;
  update public.nfc_tags set status = 'active' where id = v_tag.id;
  perform private.tag_event(v_tag, 'activated', 'Instalação na mesa confirmada. Etiqueta em uso.', private.actor_name(),
                            v_tag.table_id, null, null, v_tag.status, 'active');
  select * into v_tag from public.nfc_tags where id = p_tag_id;
  return v_tag;
end;
$$;

create or replace function public.nfc_disable_tag(p_tag_id uuid, p_reason text default null)
returns public.nfc_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag public.nfc_tags := private.lock_tag(p_tag_id, 30);
  v_table public.dining_tables;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_tag.status = 'disabled' then
    perform private.tag_not_allowed(v_tag, 'já está desativada');
  end if;
  if v_tag.table_id is not null then
    select * into v_table from public.dining_tables where id = v_tag.table_id;
  end if;
  update public.nfc_tags
  set table_id = null, target_path = null, status = 'disabled', notes = coalesce(v_reason, notes)
  where id = v_tag.id;
  perform private.tag_event(v_tag, 'disabled',
    format('Desativada%s%s', coalesce(': ' || v_reason, '.'),
           case when v_table.id is not null then format(' Deixou de estar associada à Mesa %s.', v_table.number) else '' end),
    private.actor_name(), v_table.id, case when v_table.id is not null then 'Mesa ' || v_table.number end, null, v_tag.status, 'disabled');
  select * into v_tag from public.nfc_tags where id = p_tag_id;
  return v_tag;
end;
$$;

create or replace function public.nfc_reactivate_tag(p_tag_id uuid)
returns public.nfc_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag public.nfc_tags := private.lock_tag(p_tag_id, 30);
  v_status text;
begin
  if v_tag.status <> 'disabled' then
    perform private.tag_not_allowed(v_tag, 'não está desativada');
  end if;
  v_status := private.tag_status_after_association(v_tag.configured_path, null);
  update public.nfc_tags set status = v_status where id = v_tag.id;
  perform private.tag_event(v_tag, 'reactivated',
    case when v_tag.configured_path is not null
      then 'Reativada. Contém uma URL antiga — associe-a a uma mesa e solicite a regravação.'
      else 'Reativada. Pronta para ser associada a uma mesa.' end,
    private.actor_name(), null, null, null, 'disabled', v_status);
  select * into v_tag from public.nfc_tags where id = p_tag_id;
  return v_tag;
end;
$$;

-- =====================================================================
-- EMPRESAS: registo, convites e subscrições
-- =====================================================================

/**
 * Registo self-service: o utilizador autenticado cria a sua empresa e o
 * primeiro restaurante, fica como dono e recebe o plano por omissão em teste.
 */
create or replace function public.register_company(
  p_company_name text, p_restaurant_name text, p_legal_name text default null, p_tax_id text default null,
  p_phone text default null, p_city text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_config public.platform_config;
  v_plan public.plans;
  v_company_id uuid;
  v_subscription_id uuid;
  v_restaurant_id uuid;
begin
  if v_uid is null then
    raise exception 'Inicie sessão para registar a sua empresa.' using errcode = '42501', hint = 'not_authenticated';
  end if;
  if exists (select 1 from public.staff_members where user_id = v_uid) then
    raise exception 'A sua conta já pertence a uma empresa.' using hint = 'already_member';
  end if;
  select * into v_config from public.platform_config where id;
  if not v_config.allow_self_signup then
    raise exception 'O registo de novas empresas está temporariamente fechado. Contacte a equipa TapMenu.' using hint = 'signup_closed';
  end if;
  select * into v_plan from public.plans where id = v_config.default_plan_id and active;
  if not found then
    raise exception 'A plataforma ainda não tem um plano por omissão configurado. Contacte a equipa TapMenu.' using hint = 'no_default_plan';
  end if;
  if coalesce(trim(p_company_name), '') = '' or coalesce(trim(p_restaurant_name), '') = '' then
    raise exception 'Indique o nome da empresa e do restaurante.' using hint = 'validation';
  end if;
  select * into v_profile from public.profiles where id = v_uid;

  perform set_config('tapmenu.trusted', 'on', true);

  insert into public.companies (name, legal_name, slug, tax_id, phone, email, created_by)
  values (trim(p_company_name), coalesce(nullif(trim(p_legal_name), ''), trim(p_company_name)), '',
          coalesce(trim(p_tax_id), ''), coalesce(trim(p_phone), ''), v_profile.email, v_uid)
  returning id into v_company_id;

  insert into public.subscriptions (company_id, plan_id, status, renewal_date)
  values (v_company_id, v_plan.id, case when v_config.trial_days > 0 then 'trial' else 'active' end,
          now() + make_interval(days => greatest(v_config.trial_days, 30)))
  returning id into v_subscription_id;

  insert into public.staff_members (company_id, user_id, name, email, phone, role, restaurant_ids)
  values (v_company_id, v_uid, coalesce(nullif(v_profile.full_name, ''), split_part(v_profile.email, '@', 1)),
          v_profile.email, coalesce(trim(p_phone), ''), 'company_owner', '{}');

  insert into public.restaurants (company_id, name, slug, phone, email, address)
  values (v_company_id, trim(p_restaurant_name), '', coalesce(trim(p_phone), ''), v_profile.email,
          jsonb_build_object('street', '', 'city', coalesce(trim(p_city), ''), 'province', '', 'country', 'Moçambique'))
  returning id into v_restaurant_id;

  perform set_config('tapmenu.trusted', 'off', true);
  return v_company_id;
end;
$$;

/** Super Admin regista uma empresa; o dono (opcional) é convidado por email. */
create or replace function public.admin_create_company(
  p_name text, p_plan_id uuid, p_legal_name text default null, p_tax_id text default null,
  p_phone text default null, p_email text default null, p_owner_name text default null, p_owner_email text default null,
  p_status text default 'trial')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  if not private.is_super_admin() then
    raise exception 'Apenas a equipa TapMenu pode registar empresas.' using errcode = '42501', hint = 'forbidden';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Indique o nome da empresa.' using hint = 'validation';
  end if;
  if not exists (select 1 from public.plans where id = p_plan_id) then
    raise exception 'Plano não encontrado.' using hint = 'plan_not_found';
  end if;

  insert into public.companies (name, legal_name, slug, tax_id, phone, email, created_by)
  values (trim(p_name), coalesce(nullif(trim(p_legal_name), ''), trim(p_name)), '', coalesce(trim(p_tax_id), ''),
          coalesce(trim(p_phone), ''), coalesce(trim(p_email), ''), (select auth.uid()))
  returning id into v_company_id;

  insert into public.subscriptions (company_id, plan_id, status)
  values (v_company_id, p_plan_id, coalesce(p_status, 'trial'));

  if coalesce(trim(p_owner_email), '') <> '' then
    insert into public.staff_members (company_id, name, email, role)
    values (v_company_id, coalesce(nullif(trim(p_owner_name), ''), split_part(trim(p_owner_email), '@', 1)),
            trim(p_owner_email), 'company_owner');
  end if;
  return v_company_id;
end;
$$;

/**
 * Liga convites pendentes (staff_members com o email da conta) ao
 * utilizador autenticado — só com email confirmado.
 */
create or replace function public.claim_staff_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_user auth.users;
  v_count integer := 0;
begin
  if v_uid is null then
    return 0;
  end if;
  if exists (select 1 from public.staff_members where user_id = v_uid) then
    return 0;
  end if;
  select * into v_user from auth.users where id = v_uid;
  if v_user.email is null or v_user.email_confirmed_at is null then
    return 0;
  end if;
  perform set_config('tapmenu.trusted', 'on', true);
  update public.staff_members
  set user_id = v_uid
  where id = (
    select m.id from public.staff_members m
    where lower(m.email) = lower(v_user.email) and m.user_id is null and m.is_active
    order by private.role_rank(m.role) desc, m.created_at
    limit 1)
  returning 1 into v_count;
  perform set_config('tapmenu.trusted', 'off', true);
  return coalesce(v_count, 0);
end;
$$;

/** O restaurante pede uma alteração de plano; a equipa TapMenu aplica-a. */
create table public.plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  requested_plan_id uuid not null references public.plans (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  requested_by_name text not null default '',
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.plan_change_requests enable row level security;
create policy plan_change_requests_select on public.plan_change_requests for select to authenticated
  using (private.has_company_access(company_id));
create policy plan_change_requests_update on public.plan_change_requests for update to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());
revoke insert, delete on public.plan_change_requests from authenticated;
revoke update on public.plan_change_requests from authenticated;
grant update (status, resolved_at) on public.plan_change_requests to authenticated;

create or replace function public.request_plan_change(p_plan_id uuid, p_note text default null)
returns public.plan_change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.staff_members := private.my_membership();
  v_request public.plan_change_requests;
begin
  if v_member.id is null or private.role_rank(v_member.role) < 50 then
    raise exception 'Só o dono da empresa pode pedir a alteração do plano.' using errcode = '42501', hint = 'forbidden';
  end if;
  if not exists (select 1 from public.plans where id = p_plan_id and active) then
    raise exception 'Plano não encontrado.' using hint = 'plan_not_found';
  end if;
  update public.plan_change_requests set status = 'rejected', resolved_at = now()
  where company_id = v_member.company_id and status = 'pending';
  insert into public.plan_change_requests (company_id, requested_plan_id, requested_by, requested_by_name, note)
  values (v_member.company_id, p_plan_id, (select auth.uid()), private.actor_name(), nullif(trim(coalesce(p_note, '')), ''))
  returning * into v_request;
  insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
  values (v_member.company_id, (select auth.uid()), private.actor_name(), 'subscription.change_requested',
          'Subscription', format('Pedido de alteração para o plano %s.', (select name from public.plans where id = p_plan_id)));
  return v_request;
end;
$$;

-- Histórico da subscrição gerado automaticamente.
create or replace function private.log_subscription_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := private.actor_name();
  v_new_plan public.plans;
  v_old_plan_name text;
begin
  select * into v_new_plan from public.plans where id = new.plan_id;
  if tg_op = 'INSERT' then
    insert into public.subscription_events (subscription_id, company_id, event, to_plan_name, amount, performed_by)
    values (new.id, new.company_id, case when new.status = 'trial' then 'trial_started' else 'created' end,
            v_new_plan.name, v_new_plan.price, v_actor);
    return new;
  end if;
  if new.plan_id is distinct from old.plan_id then
    select name into v_old_plan_name from public.plans where id = old.plan_id;
    insert into public.subscription_events (subscription_id, company_id, event, from_plan_name, to_plan_name, amount, performed_by)
    values (new.id, new.company_id, 'plan_changed', v_old_plan_name, v_new_plan.name, v_new_plan.price, v_actor);
    update public.plan_change_requests set status = 'approved', resolved_at = now()
    where company_id = new.company_id and status = 'pending' and requested_plan_id = new.plan_id;
  end if;
  if new.status is distinct from old.status then
    insert into public.subscription_events (subscription_id, company_id, event, to_plan_name, performed_by)
    values (new.id, new.company_id,
            case new.status when 'active' then 'activated' when 'suspended' then 'suspended' when 'cancelled' then 'cancelled'
                            when 'expired' then 'expired' else 'trial_started' end,
            v_new_plan.name, v_actor);
  end if;
  if new.renewal_date is distinct from old.renewal_date and new.renewal_date > old.renewal_date
     and new.plan_id is not distinct from old.plan_id and new.status is not distinct from old.status then
    insert into public.subscription_events (subscription_id, company_id, event, to_plan_name, performed_by, note)
    values (new.id, new.company_id, 'renewed', v_new_plan.name, v_actor, 'Data de renovação atualizada.');
  end if;
  return new;
end;
$$;
create trigger log_subscription_event after insert or update on public.subscriptions
  for each row execute function private.log_subscription_event();

-- O autor de cada evento é sempre o utilizador autenticado (não vem do cliente).
create or replace function private.stamp_subscription_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.performed_by := private.actor_name();
  end if;
  return new;
end;
$$;
create trigger stamp_subscription_event before insert on public.subscription_events
  for each row execute function private.stamp_subscription_event();

-- Auditoria automática das alterações administrativas.
create or replace function private.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_entity text := tg_argv[0];
  v_label text := coalesce(v_row ->> 'name', v_row ->> 'platform_name', v_row ->> 'id');
  v_company uuid;
  v_action text := v_entity || '.' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
begin
  v_company := case
    when tg_table_name = 'companies' then (v_row ->> 'id')::uuid
    when v_row ? 'company_id' then (v_row ->> 'company_id')::uuid
  end;
  if tg_op = 'DELETE' and tg_table_name = 'companies' then
    v_company := null;
  end if;
  insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
  values (v_company, (select auth.uid()), private.actor_name(), v_action, v_entity || ': ' || coalesce(v_label, ''),
          case tg_op when 'INSERT' then 'Criado.' when 'DELETE' then 'Eliminado.' else 'Atualizado.' end);
  return coalesce(new, old);
end;
$$;

create trigger audit_change after insert or update or delete on public.plans for each row execute function private.audit_change('plan');
create trigger audit_change after insert or update or delete on public.companies for each row execute function private.audit_change('company');
create trigger audit_change after insert or update or delete on public.restaurants for each row execute function private.audit_change('restaurant');
create trigger audit_change after insert or update or delete on public.staff_members for each row execute function private.audit_change('staff');
create trigger audit_change after update on public.platform_config for each row execute function private.audit_change('platform_config');

-- Funções internas: só usadas por políticas RLS (utilizadores autenticados)
-- e por outras funções. O schema `private` não é exposto pela API REST.
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
