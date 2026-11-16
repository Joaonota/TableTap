-- =====================================================================
-- TapMenu — 0900 · Super Admin do Sistema: suspensão e eliminação de empresas
--
-- Hierarquia:
--   Super Admin do Sistema (profiles.is_super_admin — acesso global)
--     └─ Empresa (companies)
--          └─ Estabelecimentos → Mesas → Tags NFC → Menu/Produtos
--             → Pedidos → Pagamentos → Funcionários → outros recursos
--
-- O Super Admin já tinha acesso global (private.has_company_access /
-- has_restaurant_access devolvem true para ele). Esta migração:
--
--   1. SUSPENSÃO REAL: uma empresa suspensa (companies.is_active = false)
--      deixa de dar acesso à sua equipa (RLS) e ao menu público, e não
--      aceita novas sessões, pedidos, pagamentos nem chamadas. Os dados
--      mantêm-se; o Super Admin pode reativar.
--
--   2. INTEGRIDADE: corrige as relações que impediam a eliminação em
--      cascata (products.category_id em RESTRICT; triggers de mesas e de
--      auditoria que escreviam linhas a apontar para dados a ser apagados).
--
--   3. HISTÓRICO ADMINISTRATIVO GLOBAL (platform_admin_logs): pertence à
--      plataforma, não tem chave estrangeira para empresas e é só de
--      acrescentar — nunca é apagado com uma empresa.
--
--   4. ELIMINAÇÃO CONTROLADA (admin_delete_company): só o Super Admin,
--      com confirmação pelo nome, numa única transação, sem órfãos e sem
--      tocar noutras empresas. As contas do Supabase Auth e os ficheiros
--      do Storage são removidos depois pela Edge Function
--      `admin-delete-company` (precisa da chave de serviço, que nunca
--      está no frontend). Contas por remover ficam em
--      pending_auth_deletions até a remoção ser confirmada.
-- =====================================================================

-- =====================================================================
-- 1. SUSPENSÃO
-- =====================================================================
create or replace function private.company_is_active(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.is_active from public.companies c where c.id = p_company_id), false)
$$;

-- A equipa só acede enquanto a empresa estiver ativa. O Super Admin acede sempre.
create or replace function private.has_company_access(p_company_id uuid, p_min_rank integer default 0)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1
    from public.staff_members m
    join public.companies c on c.id = m.company_id
    where m.user_id = (select auth.uid())
      and m.is_active
      and c.is_active
      and m.company_id = p_company_id
      and private.role_rank(m.role) >= p_min_rank
  )
$$;

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
    join public.companies c on c.id = m.company_id
    join public.restaurants r on r.company_id = m.company_id
    where m.user_id = (select auth.uid())
      and m.is_active
      and c.is_active
      and r.id = p_restaurant_id
      and (m.role = 'company_owner' or p_restaurant_id = any (m.restaurant_ids))
      and private.role_rank(m.role) >= p_min_rank
  )
$$;

-- Com a empresa suspensa, o utilizador continua a ler a sua própria ligação
-- e o registo da sua empresa — só para a aplicação mostrar "empresa suspensa".
create or replace function private.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff_members m where m.company_id = p_company_id and m.user_id = (select auth.uid()))
$$;

create policy staff_select_own on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy companies_select_member on public.companies for select to authenticated
  using (private.is_company_member(id));

-- Operação ao vivo bloqueada numa empresa suspensa (inclui as funções públicas da mesa).
create or replace function private.guard_company_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Corre antes de set_company_from_restaurant (ordem alfabética dos triggers):
  -- a empresa vem sempre do restaurante, nunca do cliente.
  if private.is_super_admin()
     or private.company_is_active((select r.company_id from public.restaurants r where r.id = new.restaurant_id)) then
    return new;
  end if;
  raise exception 'Este estabelecimento está temporariamente indisponível.' using errcode = '42501', hint = 'company_suspended';
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['table_sessions', 'orders', 'payments', 'service_requests']
  loop
    execute format('create trigger guard_company_active before insert on public.%I
                      for each row execute function private.guard_company_active()', t);
  end loop;
end;
$$;

-- Menu público de uma empresa suspensa: a mesa não é encontrada.
create or replace function public.get_public_table(p_restaurant_slug text, p_table_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_restaurant public.restaurants;
  v_table public.dining_tables;
begin
  select r.* into v_restaurant
  from public.restaurants r
  join public.companies c on c.id = r.company_id and c.is_active
  where r.slug = lower(p_restaurant_slug);
  if not found then
    return null;
  end if;
  select * into v_table from public.dining_tables where restaurant_id = v_restaurant.id and slug = lower(p_table_key);
  if not found then
    select * into v_table from public.dining_tables where restaurant_id = v_restaurant.id and lower(number) = lower(p_table_key);
  end if;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'restaurant', private.restaurant_json(v_restaurant),
    'table', private.table_json(v_table),
    'activeSession', case when v_table.active_session_id is null then null else private.session_json(v_table.active_session_id) end);
end;
$$;

create or replace function public.get_public_menu(p_restaurant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'tenantId', c.company_id, 'restaurantId', c.restaurant_id, 'name', c.name, 'description', c.description,
        'imageUrl', c.image_url, 'sortOrder', c.sort_order, 'isActive', c.is_active) order by c.sort_order, c.name)
      from public.categories c where c.restaurant_id = r.id and c.is_active), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'tenantId', p.company_id, 'restaurantId', p.restaurant_id, 'categoryId', p.category_id,
        'categoryName', c.name, 'name', p.name, 'description', p.description, 'imageUrl', p.image_url,
        'price', p.price, 'promotionalPrice', p.promotional_price, 'isAvailable', p.is_available,
        'isFeatured', p.is_featured, 'preparationTimeMinutes', p.preparation_time_minutes, 'station', p.station,
        'removableIngredients', to_jsonb(p.removable_ingredients), 'allergens', to_jsonb(p.allergens),
        'sortOrder', p.sort_order, 'isActive', p.is_active, 'isPromotion', p.is_promotion, 'isSpicy', p.is_spicy,
        'isVegetarian', p.is_vegetarian,
        'variants', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'priceDelta', v.price_delta) order by v.sort_order)
                              from public.product_variants v where v.product_id = p.id), '[]'::jsonb),
        'addons', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'price', a.price, 'isDefault', a.is_default) order by a.sort_order)
                            from public.product_addons a where a.product_id = p.id), '[]'::jsonb)
      ) order by p.sort_order, p.name)
      from public.products p join public.categories c on c.id = p.category_id
      where p.restaurant_id = r.id and p.is_active and c.is_active), '[]'::jsonb),
    'customization', (select m.theme from public.menu_customizations m where m.restaurant_id = r.id)
  )
  from public.restaurants r
  join public.companies co on co.id = r.company_id and co.is_active
  where r.id = p_restaurant_id
$$;

-- =====================================================================
-- 2. INTEGRIDADE DAS RELAÇÕES
-- =====================================================================
-- RESTRICT é verificado linha a linha, a meio da cascata: ao apagar um
-- restaurante (ou a empresa), a categoria podia ser apagada antes dos seus
-- produtos e a operação falhava. NO ACTION verifica no fim da instrução:
-- apagar diretamente uma categoria com produtos continua a ser recusado.
alter table public.products drop constraint products_category_id_fkey;
alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id) references public.categories (id) on delete no action;

/** Eliminação de empresa em curso nesta transação (ver admin_delete_company). */
create or replace function private.is_purging_company()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('tapmenu.purging_company', true), '') <> ''
$$;

-- Remover uma mesa: recusa com sessão ativa; desassocia etiquetas com histórico.
-- Quando é o próprio restaurante (ou a empresa) a ser eliminado, as
-- etiquetas e o histórico vão com ele: não há nada a desassociar.
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
  if private.is_purging_company()
     or not exists (select 1 from public.restaurants r where r.id = old.restaurant_id) then
    return old;
  end if;
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

-- Auditoria automática: não escreve linhas a apontar para uma empresa que
-- está a ser (ou já foi) eliminada. A eliminação fica no histórico global.
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
  if private.is_purging_company() then
    return coalesce(new, old);
  end if;
  v_company := case
    when tg_table_name = 'companies' then (v_row ->> 'id')::uuid
    when v_row ? 'company_id' then (v_row ->> 'company_id')::uuid
  end;
  if v_company is not null and not exists (select 1 from public.companies c where c.id = v_company) then
    v_company := null;
  end if;
  insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
  values (v_company, (select auth.uid()), private.actor_name(), v_action, v_entity || ': ' || coalesce(v_label, ''),
          case tg_op when 'INSERT' then 'Criado.' when 'DELETE' then 'Eliminado.' else 'Atualizado.' end);
  return coalesce(new, old);
end;
$$;

-- Uma empresa só é eliminada pela função controlada (nunca por DELETE direto).
drop policy if exists companies_delete on public.companies;
revoke delete on public.companies from authenticated;

-- =====================================================================
-- 3. HISTÓRICO ADMINISTRATIVO GLOBAL
-- =====================================================================
create table public.platform_admin_logs (
  id uuid primary key default gen_random_uuid(),
  -- Sem chaves estrangeiras: o registo sobrevive ao autor e à empresa.
  actor_id uuid,
  actor_name text not null default '',
  actor_email text not null default '',
  action text not null,
  target_type text not null default '',
  target_id uuid,
  target_name text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.platform_admin_logs (created_at desc);
create index on public.platform_admin_logs (target_id, created_at desc);

alter table public.platform_admin_logs enable row level security;
create policy platform_admin_logs_select on public.platform_admin_logs for select to authenticated
  using (private.is_super_admin());
revoke all on public.platform_admin_logs from anon;
revoke insert, update, delete on public.platform_admin_logs from authenticated;

-- Só de acrescentar: nem a chave de serviço altera ou apaga o histórico.
create or replace function private.platform_admin_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O histórico administrativo da plataforma não pode ser alterado nem eliminado.' using errcode = '42501', hint = 'forbidden';
end;
$$;
create trigger platform_admin_logs_immutable before update or delete on public.platform_admin_logs
  for each row execute function private.platform_admin_logs_immutable();

/** Regista uma operação do Super Admin no histórico global. */
create or replace function private.log_platform_action(
  p_action text, p_target_type text, p_target_id uuid, p_target_name text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  insert into public.platform_admin_logs (actor_id, actor_name, actor_email, action, target_type, target_id, target_name, details)
  values (v_uid, private.actor_name(), coalesce((select p.email from public.profiles p where p.id = v_uid), ''),
          p_action, p_target_type, p_target_id, coalesce(p_target_name, ''), coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Operações do Super Admin sobre empresas e subscrições → histórico global.
create or replace function private.log_platform_company_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_super_admin() or private.is_purging_company() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform private.log_platform_action('company.created', 'company', new.id, new.name,
      jsonb_build_object('legalName', new.legal_name, 'email', new.email, 'active', new.is_active));
  elsif new.is_active is distinct from old.is_active then
    perform private.log_platform_action(case when new.is_active then 'company.activated' else 'company.suspended' end,
      'company', new.id, new.name, '{}'::jsonb);
  end if;
  return new;
end;
$$;
create trigger log_platform_company_change after insert or update of is_active on public.companies
  for each row execute function private.log_platform_company_change();

create or replace function private.log_platform_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company text := (select c.name from public.companies c where c.id = new.company_id);
begin
  if not private.is_super_admin() or private.is_purging_company() then
    return new;
  end if;
  if new.plan_id is distinct from old.plan_id then
    perform private.log_platform_action('subscription.plan_changed', 'company', new.company_id, v_company,
      jsonb_build_object('fromPlan', (select p.name from public.plans p where p.id = old.plan_id),
                         'toPlan', (select p.name from public.plans p where p.id = new.plan_id)));
  end if;
  if new.status is distinct from old.status then
    perform private.log_platform_action('subscription.status_changed', 'company', new.company_id, v_company,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger log_platform_subscription_change after update of plan_id, status on public.subscriptions
  for each row execute function private.log_platform_subscription_change();

-- =====================================================================
-- 4. ELIMINAÇÃO CONTROLADA DE EMPRESAS
-- =====================================================================
/**
 * Contas do Supabase Auth a remover depois da eliminação de uma empresa.
 * Preenchida por admin_delete_company; esvaziada pela Edge Function
 * `admin-delete-company` (chave de serviço) à medida que remove as contas.
 */
create table public.pending_auth_deletions (
  user_id uuid primary key,
  email text not null default '',
  company_id uuid not null,
  company_name text not null default '',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.pending_auth_deletions enable row level security;
create policy pending_auth_deletions_select on public.pending_auth_deletions for select to authenticated
  using (private.is_super_admin());
revoke all on public.pending_auth_deletions from anon;
revoke insert, update, delete on public.pending_auth_deletions from authenticated;

/** Contagem dos dados de uma empresa (resumo antes de eliminar e registo no histórico). */
create or replace function private.company_data_summary(p_company_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'restaurants',     (select count(*) from public.restaurants where company_id = p_company_id),
    'tables',          (select count(*) from public.dining_tables where company_id = p_company_id),
    'tableSessions',   (select count(*) from public.table_sessions where company_id = p_company_id),
    'nfcTags',         (select count(*) from public.nfc_tags where company_id = p_company_id),
    'categories',      (select count(*) from public.categories where company_id = p_company_id),
    'products',        (select count(*) from public.products where company_id = p_company_id),
    'orders',          (select count(*) from public.orders where company_id = p_company_id),
    'payments',        (select count(*) from public.payments where company_id = p_company_id),
    'serviceRequests', (select count(*) from public.service_requests where company_id = p_company_id),
    'staff',           (select count(*) from public.staff_members where company_id = p_company_id),
    'users',           (select count(*) from public.staff_members where company_id = p_company_id and user_id is not null)
  )
$$;

/**
 * Contas do Supabase Auth que pertencem SÓ a esta empresa:
 *   - ligadas a um registo da equipa da empresa, ou
 *   - com o email de um membro/convite da empresa ainda por aceitar.
 * Nunca inclui: Super Admins, quem executa a operação, nem contas ligadas
 * (ou convidadas) a outra empresa.
 */
create or replace function private.company_auth_users(p_company_id uuid)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  with emails as (
    select lower(m.email) as email from public.staff_members m where m.company_id = p_company_id
    union
    select lower(i.owner_email) from public.establishment_invitations i where i.company_id = p_company_id
  ),
  candidates as (
    select u.id, coalesce(u.email, '') as email from auth.users u
    where u.id in (select m.user_id from public.staff_members m where m.company_id = p_company_id and m.user_id is not null)
       or u.id in (select i.user_id from public.establishment_invitations i where i.company_id = p_company_id and i.user_id is not null)
       or lower(u.email) in (select e.email from emails e)
  )
  select c.id, c.email
  from candidates c
  where c.id is distinct from (select auth.uid())
    and not exists (select 1 from public.profiles p where p.id = c.id and p.is_super_admin)
    and not exists (select 1 from public.staff_members m
                    where m.company_id <> p_company_id
                      and (m.user_id = c.id or (m.user_id is null and lower(m.email) = lower(c.email))))
    and not exists (select 1 from public.establishment_invitations i
                    where i.company_id <> p_company_id
                      and (i.user_id = c.id or lower(i.owner_email) = lower(c.email)))
$$;

/** Resumo mostrado ao Super Admin antes de confirmar a eliminação. */
create or replace function public.admin_company_deletion_preview(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  if not private.is_super_admin() then
    raise exception 'Apenas o Super Admin do Sistema pode eliminar empresas.' using errcode = '42501', hint = 'forbidden';
  end if;
  select * into v_company from public.companies where id = p_company_id;
  if not found then
    raise exception 'Empresa não encontrada.' using hint = 'not_found';
  end if;
  return jsonb_build_object(
    'companyId', v_company.id,
    'name', v_company.name,
    'legalName', v_company.legal_name,
    'email', v_company.email,
    'isActive', v_company.is_active,
    'createdAt', v_company.created_at,
    'planName', (select p.name from public.subscriptions s join public.plans p on p.id = s.plan_id where s.company_id = p_company_id),
    'subscriptionStatus', (select s.status from public.subscriptions s where s.company_id = p_company_id),
    'counts', private.company_data_summary(p_company_id),
    'authAccounts', (select count(*) from private.company_auth_users(p_company_id))
  );
end;
$$;

/**
 * Elimina a empresa e TODOS os seus dados, numa única transação.
 *
 * - Só o Super Admin; exige o nome da empresa como confirmação.
 * - Apaga explicitamente, dos dados mais dependentes para a empresa, e
 *   confirma no fim que nenhuma tabela ficou com linhas desta empresa
 *   (se ficar, a transação inteira é revertida).
 * - Os registos de auditoria da empresa saem com ela; as ações do Super
 *   Admin e a própria eliminação ficam no histórico global.
 * - Devolve as contas Auth a remover (também gravadas em
 *   pending_auth_deletions) para a Edge Function as eliminar.
 */
create or replace function public.admin_delete_company(p_company_id uuid, p_confirm_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_summary jsonb;
  v_plan text;
  v_users jsonb;
  v_table record;
  v_left bigint;
begin
  if not private.is_super_admin() then
    raise exception 'Apenas o Super Admin do Sistema pode eliminar empresas.' using errcode = '42501', hint = 'forbidden';
  end if;

  select * into v_company from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'Empresa não encontrada.' using hint = 'not_found';
  end if;
  if lower(trim(coalesce(p_confirm_name, ''))) <> lower(trim(v_company.name)) then
    raise exception 'O nome escrito não corresponde ao nome da empresa.' using hint = 'confirmation_mismatch';
  end if;

  v_summary := private.company_data_summary(p_company_id);
  select p.name into v_plan from public.subscriptions s join public.plans p on p.id = s.plan_id where s.company_id = p_company_id;
  select coalesce(jsonb_agg(jsonb_build_object('userId', u.user_id, 'email', u.email)), '[]'::jsonb)
  into v_users from private.company_auth_users(p_company_id) u;

  perform set_config('tapmenu.purging_company', p_company_id::text, true);

  -- Operação e atendimento
  delete from public.notifications where company_id = p_company_id;
  delete from public.service_requests where company_id = p_company_id;
  delete from public.payments where company_id = p_company_id;
  delete from public.order_status_history h using public.restaurants r where h.restaurant_id = r.id and r.company_id = p_company_id;
  delete from public.order_items i using public.restaurants r where i.restaurant_id = r.id and r.company_id = p_company_id;
  delete from public.orders where company_id = p_company_id;
  -- Acesso digital (NFC)
  delete from public.nfc_tag_events e using public.restaurants r where e.restaurant_id = r.id and r.company_id = p_company_id;
  delete from public.nfc_tags where company_id = p_company_id;
  -- Sessões das mesas e mesas
  update public.dining_tables set active_session_id = null where company_id = p_company_id and active_session_id is not null;
  delete from public.session_participants sp using public.table_sessions s where sp.session_id = s.id and s.company_id = p_company_id;
  delete from public.table_sessions where company_id = p_company_id;
  delete from public.dining_tables where company_id = p_company_id;
  -- Menu
  delete from public.product_addons a using public.restaurants r where a.restaurant_id = r.id and r.company_id = p_company_id;
  delete from public.product_variants v using public.restaurants r where v.restaurant_id = r.id and r.company_id = p_company_id;
  delete from public.products where company_id = p_company_id;
  delete from public.categories where company_id = p_company_id;
  delete from public.menu_customizations where company_id = p_company_id;
  -- Estabelecimentos
  delete from public.restaurant_counters c using public.restaurants r where c.restaurant_id = r.id and r.company_id = p_company_id;
  delete from public.restaurants where company_id = p_company_id;
  -- Equipa, subscrição, onboarding e histórico da empresa
  delete from public.staff_members where company_id = p_company_id;
  delete from public.plan_change_requests where company_id = p_company_id;
  delete from public.subscription_events where company_id = p_company_id;
  delete from public.subscriptions where company_id = p_company_id;
  delete from public.establishment_invitations where company_id = p_company_id;
  -- Auditoria da empresa (atividade da equipa); as ações do Super Admin ficam.
  delete from public.audit_logs a
  where a.company_id = p_company_id
    and not exists (select 1 from public.profiles p where p.id = a.user_id and p.is_super_admin);
  -- Empresa
  delete from public.companies where id = p_company_id;

  -- Verificação: nenhuma tabela pode ficar com dados desta empresa.
  for v_table in
    select c.table_name from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'company_id'
      and c.table_name not in ('audit_logs', 'pending_auth_deletions')
  loop
    execute format('select count(*) from public.%I where company_id = $1', v_table.table_name) into v_left using p_company_id;
    if v_left > 0 then
      raise exception 'Eliminação interrompida: % registo(s) em % ficariam sem empresa.', v_left, v_table.table_name
        using hint = 'orphan_data';
    end if;
  end loop;

  perform set_config('tapmenu.purging_company', '', true);

  insert into public.pending_auth_deletions (user_id, email, company_id, company_name)
  select (u ->> 'userId')::uuid, u ->> 'email', p_company_id, v_company.name
  from jsonb_array_elements(v_users) u
  on conflict (user_id) do nothing;

  perform private.log_platform_action('company.deleted', 'company', p_company_id, v_company.name,
    jsonb_build_object('legalName', v_company.legal_name, 'email', v_company.email, 'plan', v_plan,
                       'deleted', v_summary, 'authAccounts', jsonb_array_length(v_users)));

  return jsonb_build_object('companyId', p_company_id, 'companyName', v_company.name,
                            'deleted', v_summary, 'authUsers', v_users);
end;
$$;

-- =====================================================================
-- Privilégios
-- =====================================================================
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
revoke execute on function
  public.admin_company_deletion_preview(uuid),
  public.admin_delete_company(uuid, text)
from public, anon;
grant execute on function
  public.admin_company_deletion_preview(uuid),
  public.admin_delete_company(uuid, text)
to authenticated;
-- Funções públicas da mesa (anónimas) redefinidas acima.
grant execute on function public.get_public_table(text, text), public.get_public_menu(uuid) to anon;
