-- =====================================================================
-- TapMenu — 0200 · Segurança: papéis, isolamento e RLS
--
-- Papéis (hierarquia de permissões dentro de uma empresa):
--   company_owner (50) > restaurant_admin (40) > manager (30)
--   > receptionist / waiter / kitchen_staff (10)
-- Super Admin = profiles.is_super_admin (equipa TapMenu, acesso global).
--
-- Regra de ouro: o frontend nunca é a única barreira. Todas as tabelas
-- têm RLS; colunas sensíveis só mudam através de funções com validação.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções de permissão (security definer para não recursar no RLS)
-- ---------------------------------------------------------------------
create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = (select auth.uid())), false)
$$;

create or replace function private.role_rank(p_role text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'company_owner' then 50
    when 'restaurant_admin' then 40
    when 'manager' then 30
    when 'receptionist' then 10
    when 'waiter' then 10
    when 'kitchen_staff' then 10
    else 0
  end
$$;

/** Ligação ativa do utilizador atual a uma empresa (ou nada). */
create or replace function private.my_membership()
returns public.staff_members
language sql
stable
security definer
set search_path = ''
as $$
  select m.* from public.staff_members m
  where m.user_id = (select auth.uid()) and m.is_active
  limit 1
$$;

create or replace function private.has_company_access(p_company_id uuid, p_min_rank integer default 0)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1 from public.staff_members m
    where m.user_id = (select auth.uid())
      and m.is_active
      and m.company_id = p_company_id
      and private.role_rank(m.role) >= p_min_rank
  )
$$;

/**
 * Acesso a um restaurante: o dono da empresa acede a todos; os restantes
 * papéis só aos restaurantes que lhes foram atribuídos.
 */
create or replace function private.has_restaurant_access(p_restaurant_id uuid, p_min_rank integer default 0)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1
    from public.staff_members m
    join public.restaurants r on r.company_id = m.company_id
    where m.user_id = (select auth.uid())
      and m.is_active
      and r.id = p_restaurant_id
      and (m.role = 'company_owner' or p_restaurant_id = any (m.restaurant_ids))
      and private.role_rank(m.role) >= p_min_rank
  )
$$;

/** O utilizador atual e `p_user_id` pertencem à mesma empresa. */
create or replace function private.shares_company(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members me
    join public.staff_members other on other.company_id = me.company_id
    where me.user_id = (select auth.uid()) and me.is_active and other.user_id = p_user_id
  )
$$;

/** Nome a registar em históricos ("quem fez"). */
create or replace function private.actor_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif((select p.full_name from public.profiles p where p.id = (select auth.uid())), ''),
    (select p.email from public.profiles p where p.id = (select auth.uid())),
    'Cliente'
  )
$$;

create or replace function private.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Perfil criado automaticamente no registo (Supabase Auth)
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------
-- company_id derivado do restaurante (nunca confiar no cliente)
-- ---------------------------------------------------------------------
create or replace function private.set_company_from_restaurant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.restaurant_id is distinct from old.restaurant_id then
    raise exception 'Não é possível mover este registo para outro restaurante.' using errcode = 'P0001';
  end if;
  select r.company_id into new.company_id from public.restaurants r where r.id = new.restaurant_id;
  if new.company_id is null then
    raise exception 'Restaurante não encontrado.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['dining_tables', 'table_sessions', 'categories', 'products', 'orders', 'payments',
                           'service_requests', 'notifications', 'menu_customizations', 'nfc_tags']
  loop
    execute format(
      'create trigger set_company_from_restaurant before insert or update of restaurant_id, company_id on public.%I
         for each row execute function private.set_company_from_restaurant()', t);
  end loop;
end;
$$;

-- Variantes/adicionais herdam o restaurante do produto; itens e histórico, do pedido.
create or replace function private.set_restaurant_from_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.restaurant_id into new.restaurant_id from public.products p where p.id = new.product_id;
  if new.restaurant_id is null then
    raise exception 'Produto não encontrado.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger set_restaurant_from_product before insert or update of product_id, restaurant_id on public.product_variants
  for each row execute function private.set_restaurant_from_product();
create trigger set_restaurant_from_product before insert or update of product_id, restaurant_id on public.product_addons
  for each row execute function private.set_restaurant_from_product();

-- A categoria de um produto tem de ser do mesmo restaurante.
create or replace function private.check_product_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.categories c where c.id = new.category_id and c.restaurant_id = new.restaurant_id) then
    raise exception 'A categoria escolhida não pertence a este restaurante.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger check_product_category before insert or update of category_id, restaurant_id on public.products
  for each row execute function private.check_product_category();

-- ---------------------------------------------------------------------
-- Equipa: impedir escalada de privilégios
-- ---------------------------------------------------------------------
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
  if private.is_super_admin() then
    return new;
  end if;

  me := private.my_membership();
  my_rank := private.role_rank(me.role);

  if private.role_rank(new.role) > my_rank
     or (tg_op = 'UPDATE' and private.role_rank(old.role) > my_rank) then
    raise exception 'Não tem permissão para atribuir ou alterar este papel.' using errcode = '42501';
  end if;

  if me.role <> 'company_owner' then
    -- Só pode atribuir restaurantes a que tem acesso.
    if exists (select 1 from unnest(new.restaurant_ids) rid where not (rid = any (me.restaurant_ids))) then
      raise exception 'Só pode atribuir restaurantes a que tem acesso.' using errcode = '42501';
    end if;
  end if;

  -- Todos os restaurantes atribuídos têm de ser da mesma empresa.
  if exists (
    select 1 from unnest(new.restaurant_ids) rid
    where not exists (select 1 from public.restaurants r where r.id = rid and r.company_id = new.company_id)
  ) then
    raise exception 'Restaurante atribuído não pertence a esta empresa.' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and new.user_id = (select auth.uid()) and (new.role <> old.role or not new.is_active) then
    raise exception 'Não pode alterar o seu próprio papel nem desativar a sua conta.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_staff_member before insert or update on public.staff_members
  for each row execute function private.guard_staff_member();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.platform_config enable row level security;
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.restaurants enable row level security;
alter table public.staff_members enable row level security;
alter table public.dining_tables enable row level security;
alter table public.table_sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_addons enable row level security;
alter table public.restaurant_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.service_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.menu_customizations enable row level security;
alter table public.nfc_tags enable row level security;
alter table public.nfc_tag_events enable row level security;
alter table public.audit_logs enable row level security;

-- Planos: leitura pública dos ativos (página de preços); gestão só Super Admin.
create policy plans_select_public on public.plans for select to anon using (active);
create policy plans_select_auth on public.plans for select to authenticated using (true);
create policy plans_write on public.plans for all to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());

create policy platform_config_select on public.platform_config for select to anon, authenticated using (true);
create policy platform_config_update on public.platform_config for update to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_super_admin() or private.shares_company(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_update_super on public.profiles for update to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());

create policy companies_select on public.companies for select to authenticated
  using (private.has_company_access(id));
create policy companies_insert on public.companies for insert to authenticated
  with check (private.is_super_admin());
create policy companies_update on public.companies for update to authenticated
  using (private.has_company_access(id, 50)) with check (private.has_company_access(id, 50));
create policy companies_delete on public.companies for delete to authenticated
  using (private.is_super_admin());

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (private.has_company_access(company_id));
create policy subscriptions_write on public.subscriptions for all to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());

create policy subscription_events_select on public.subscription_events for select to authenticated
  using (private.has_company_access(company_id));
create policy subscription_events_write on public.subscription_events for insert to authenticated
  with check (private.is_super_admin());

create policy restaurants_select on public.restaurants for select to authenticated
  using (private.has_restaurant_access(id));
create policy restaurants_insert on public.restaurants for insert to authenticated
  with check (private.has_company_access(company_id, 50));
create policy restaurants_update on public.restaurants for update to authenticated
  using (private.has_restaurant_access(id, 40)) with check (private.has_restaurant_access(id, 40));
create policy restaurants_delete on public.restaurants for delete to authenticated
  using (private.has_company_access(company_id, 50));

create policy staff_select on public.staff_members for select to authenticated
  using (private.has_company_access(company_id));
create policy staff_insert on public.staff_members for insert to authenticated
  with check (private.has_company_access(company_id, 40));
create policy staff_update on public.staff_members for update to authenticated
  using (private.has_company_access(company_id, 40)) with check (private.has_company_access(company_id, 40));
create policy staff_delete on public.staff_members for delete to authenticated
  using (private.has_company_access(company_id, 40)
         and (role <> 'company_owner' or private.has_company_access(company_id, 50))
         and user_id is distinct from (select auth.uid()));

-- Mesas e menu: leitura por toda a equipa do restaurante; gestão a partir de gerente.
create policy dining_tables_select on public.dining_tables for select to authenticated
  using (private.has_restaurant_access(restaurant_id));
create policy dining_tables_insert on public.dining_tables for insert to authenticated
  with check (private.has_restaurant_access(restaurant_id, 30));
create policy dining_tables_update on public.dining_tables for update to authenticated
  using (private.has_restaurant_access(restaurant_id, 30)) with check (private.has_restaurant_access(restaurant_id, 30));
create policy dining_tables_delete on public.dining_tables for delete to authenticated
  using (private.has_restaurant_access(restaurant_id, 30));

create policy table_sessions_select on public.table_sessions for select to authenticated
  using (private.has_restaurant_access(restaurant_id));
create policy session_participants_select on public.session_participants for select to authenticated
  using (exists (select 1 from public.table_sessions s where s.id = session_id and private.has_restaurant_access(s.restaurant_id)));

do $$
declare
  t text;
begin
  foreach t in array array['categories', 'products', 'product_variants', 'product_addons', 'menu_customizations']
  loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (private.has_restaurant_access(restaurant_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (private.has_restaurant_access(restaurant_id, 30))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (private.has_restaurant_access(restaurant_id, 30)) with check (private.has_restaurant_access(restaurant_id, 30))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (private.has_restaurant_access(restaurant_id, 30))', t);
  end loop;
end;
$$;

-- Operação: toda a equipa do restaurante lê e atualiza (pedidos criados por função).
create policy orders_select on public.orders for select to authenticated using (private.has_restaurant_access(restaurant_id));
create policy orders_update on public.orders for update to authenticated
  using (private.has_restaurant_access(restaurant_id)) with check (private.has_restaurant_access(restaurant_id));
create policy order_items_select on public.order_items for select to authenticated using (private.has_restaurant_access(restaurant_id));
create policy order_status_history_select on public.order_status_history for select to authenticated using (private.has_restaurant_access(restaurant_id));

create policy payments_select on public.payments for select to authenticated using (private.has_restaurant_access(restaurant_id));
create policy payments_insert on public.payments for insert to authenticated with check (private.has_restaurant_access(restaurant_id));
create policy payments_update on public.payments for update to authenticated
  using (private.has_restaurant_access(restaurant_id)) with check (private.has_restaurant_access(restaurant_id));

create policy service_requests_select on public.service_requests for select to authenticated using (private.has_restaurant_access(restaurant_id));
create policy service_requests_update on public.service_requests for update to authenticated
  using (private.has_restaurant_access(restaurant_id)) with check (private.has_restaurant_access(restaurant_id));

create policy notifications_select on public.notifications for select to authenticated using (private.has_restaurant_access(restaurant_id));
create policy notifications_update on public.notifications for update to authenticated
  using (private.has_restaurant_access(restaurant_id)) with check (private.has_restaurant_access(restaurant_id));

create policy nfc_tags_select on public.nfc_tags for select to authenticated using (private.has_restaurant_access(restaurant_id));
create policy nfc_tag_events_select on public.nfc_tag_events for select to authenticated using (private.has_restaurant_access(restaurant_id));

-- Auditoria: Super Admin vê tudo; o dono da empresa vê a da sua empresa.
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (private.is_super_admin() or (company_id is not null and private.has_company_access(company_id, 50)));
create policy audit_logs_insert on public.audit_logs for insert to authenticated
  with check (private.is_super_admin() or (company_id is not null and private.has_company_access(company_id)));

-- restaurant_counters: sem políticas (só funções internas).

-- ---------------------------------------------------------------------
-- Privilégios por coluna: o que o cliente pode escrever diretamente.
-- (O Supabase concede tudo por omissão; aqui restringimos.)
-- ---------------------------------------------------------------------
revoke insert, update, delete on all tables in schema public from anon;

revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

revoke update on public.staff_members from authenticated;
revoke insert on public.staff_members from authenticated;
grant insert (company_id, name, email, phone, role, restaurant_ids, avatar_url, hire_date, is_active) on public.staff_members to authenticated;
grant update (name, email, phone, role, restaurant_ids, avatar_url, hire_date, is_active) on public.staff_members to authenticated;

revoke insert, update on public.dining_tables from authenticated;
grant insert (restaurant_id, number, name, area, capacity, is_active) on public.dining_tables to authenticated;
grant update (number, name, area, capacity, is_active) on public.dining_tables to authenticated;

revoke insert, update, delete on public.table_sessions, public.session_participants from authenticated;
revoke insert, update, delete on public.orders, public.order_items, public.order_status_history from authenticated;
grant update (status, payment_status, payment_method, customer_name, customer_phone, notes) on public.orders to authenticated;

revoke insert, update, delete on public.payments from authenticated;
grant insert (restaurant_id, order_id, amount, method, status, transaction_reference, customer_phone, notes) on public.payments to authenticated;
grant update (status, transaction_reference, notes) on public.payments to authenticated;

revoke insert, update, delete on public.service_requests from authenticated;
grant update (status, assigned_to_user_id, assigned_to_name, notes) on public.service_requests to authenticated;

revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke insert, update, delete on public.nfc_tags, public.nfc_tag_events from authenticated;
revoke all on public.restaurant_counters from anon, authenticated;

revoke insert, update, delete on public.subscription_events from authenticated;
grant insert (subscription_id, company_id, event, from_plan_name, to_plan_name, amount, note, performed_by) on public.subscription_events to authenticated;

revoke insert, update, delete on public.audit_logs from authenticated;
grant insert (company_id, action, resource, details) on public.audit_logs to authenticated;

revoke update on public.companies from authenticated;
grant update (name, legal_name, tax_id, logo_url, primary_color, phone, email, is_active) on public.companies to authenticated;

revoke update on public.restaurants from authenticated;
grant update (name, description, cover_image_url, logo_url, address, phone, email, currency, timezone,
              opening_hours, is_active, tax_rate, settings) on public.restaurants to authenticated;

-- Registos de auditoria inseridos pelo cliente: autor = utilizador autenticado.
create or replace function private.stamp_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := (select auth.uid());
  new.user_name := private.actor_name();
  return new;
end;
$$;

create trigger stamp_audit_log before insert on public.audit_logs
  for each row when (new.user_id is null)
  execute function private.stamp_audit_log();

-- Só o dono da empresa (ou o Super Admin) ativa/desativa a empresa.
create or replace function private.guard_company_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active is distinct from old.is_active and not private.is_super_admin() then
    raise exception 'Só a equipa TapMenu pode ativar ou suspender uma empresa.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_company_update before update on public.companies
  for each row execute function private.guard_company_update();

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
