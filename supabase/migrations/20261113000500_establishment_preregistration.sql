-- =====================================================================
-- TapMenu — 0500 · Pré-registo de estabelecimentos pelo Super Admin
--
-- Novo modelo de adesão:
--   1. Não há registo público de empresas: só o Super Admin cria e
--      autoriza estabelecimentos (admin_preregister_establishment).
--   2. O responsável recebe um convite do Supabase Auth (Edge Function
--      `invite-establishment`) e define a sua palavra-passe no primeiro
--      acesso. Nenhuma palavra-passe passa pelo TapMenu nem fica guardada
--      fora do Supabase Auth.
--   3. No primeiro acesso, o responsável completa os dados do
--      estabelecimento num assistente (complete_restaurant_onboarding).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fechar o registo público de empresas
-- ---------------------------------------------------------------------
update public.platform_config set allow_self_signup = false;
alter table public.platform_config alter column allow_self_signup set default false;
drop function if exists public.register_company(text, text, text, text, text, text);

-- ---------------------------------------------------------------------
-- 2. Condições comerciais ajustadas por subscrição
--    null = usar o que está definido no plano.
-- ---------------------------------------------------------------------
alter table public.subscriptions
  add column custom_price numeric(12, 2) check (custom_price is null or custom_price >= 0),
  add column custom_features jsonb check (custom_features is null or jsonb_typeof(custom_features) = 'array'),
  add column custom_limits jsonb check (custom_limits is null or jsonb_typeof(custom_limits) = 'array');

/**
 * Plano efetivo: plano da subscrição (ou o plano por omissão), com as
 * condições ajustadas da subscrição por cima. Os limites e funcionalidades
 * aplicados em toda a base de dados passam por aqui.
 */
create or replace function private.effective_plan(p_company_id uuid)
returns public.plans
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_plan public.plans;
begin
  select * into v_sub from public.subscriptions s where s.company_id = p_company_id;
  select * into v_plan from public.plans p
  where p.id = coalesce(v_sub.plan_id, (select c.default_plan_id from public.platform_config c where c.id));
  if v_plan.id is null then
    return null;
  end if;
  if v_sub.id is not null then
    v_plan.price := coalesce(v_sub.custom_price, v_plan.price);
    v_plan.features := coalesce(v_sub.custom_features, v_plan.features);
    v_plan.limits := coalesce(v_sub.custom_limits, v_plan.limits);
  end if;
  return v_plan;
end;
$$;

-- Ao mudar de plano, as condições ajustadas do plano anterior deixam de
-- valer (exceto se forem redefinidas na mesma alteração).
create or replace function private.reset_custom_conditions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.plan_id is distinct from old.plan_id then
    if new.custom_price is not distinct from old.custom_price then new.custom_price := null; end if;
    if new.custom_features is not distinct from old.custom_features then new.custom_features := null; end if;
    if new.custom_limits is not distinct from old.custom_limits then new.custom_limits := null; end if;
  end if;
  return new;
end;
$$;
create trigger reset_custom_conditions before update of plan_id on public.subscriptions
  for each row execute function private.reset_custom_conditions();

-- ---------------------------------------------------------------------
-- 3. Dados completados pelo estabelecimento no primeiro acesso
-- ---------------------------------------------------------------------
alter table public.restaurants
  add column category text not null default '',
  add column language text not null default 'pt',
  -- { "lat": -25.96, "lng": 32.58 } (opcional)
  add column location jsonb check (location is null or jsonb_typeof(location) = 'object'),
  add column additional_info text not null default '',
  -- [{ "day": 1, "open": true, "from": "08:00", "to": "22:00" }, ...]  (day: 0 = domingo)
  add column opening_schedule jsonb not null default '[]'::jsonb check (jsonb_typeof(opening_schedule) = 'array'),
  -- null = assistente de configuração inicial por concluir.
  -- Restaurantes existentes e criados pelo próprio painel já contam como configurados.
  add column onboarding_completed_at timestamptz default now();

grant update (category, language, location, additional_info, opening_schedule) on public.restaurants to authenticated;

-- ---------------------------------------------------------------------
-- 4. Primeiro acesso: o responsável tem de definir a palavra-passe
--    (só a Edge Function, com a chave de serviço, liga esta marca).
-- ---------------------------------------------------------------------
alter table public.profiles add column must_change_password boolean not null default false;

-- ---------------------------------------------------------------------
-- 5. Pré-registos (dados internos — só a equipa TapMenu os vê)
-- ---------------------------------------------------------------------
create table public.establishment_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  owner_name text not null check (length(trim(owner_name)) > 0),
  owner_email text not null check (owner_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  owner_phone text not null default '',
  country text not null default 'Moçambique',
  city text not null default '',
  internal_notes text not null default '',
  -- pending: pré-registado · invited: convite emitido · accepted: palavra-passe definida
  status text not null default 'pending' check (status in ('pending', 'invited', 'accepted')),
  delivery text check (delivery in ('email', 'link')),
  user_id uuid references auth.users (id) on delete set null,
  invite_count integer not null default 0,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.establishment_invitations (lower(owner_email));
create trigger touch_updated_at before update on public.establishment_invitations
  for each row execute function private.touch_updated_at();

alter table public.establishment_invitations enable row level security;
create policy establishment_invitations_select on public.establishment_invitations for select to authenticated
  using (private.is_super_admin());
create policy establishment_invitations_update on public.establishment_invitations for update to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());
revoke all on public.establishment_invitations from anon;
revoke insert, update, delete on public.establishment_invitations from authenticated;
grant update (owner_name, owner_phone, country, city, internal_notes) on public.establishment_invitations to authenticated;

-- ---------------------------------------------------------------------
-- 6. Pré-registo (Super Admin)
-- ---------------------------------------------------------------------
/**
 * Cria, numa só transação: empresa, subscrição (com condições ajustadas
 * opcionais), restaurante por configurar, ligação do responsável como dono
 * (fica pendente até ele entrar) e o registo interno do pré-registo.
 *
 * p_data: { establishmentName, companyName, ownerName, ownerEmail, ownerPhone,
 *           country, city, planId, subscriptionStatus, startDate (AAAA-MM-DD),
 *           internalNotes, customPrice?, customFeatures?, customLimits? }
 * Devolve o id do pré-registo (establishment_invitations).
 */
create or replace function public.admin_preregister_establishment(p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_establishment text := trim(coalesce(p_data ->> 'establishmentName', ''));
  v_company text := trim(coalesce(p_data ->> 'companyName', ''));
  v_owner text := trim(coalesce(p_data ->> 'ownerName', ''));
  v_email text := lower(trim(coalesce(p_data ->> 'ownerEmail', '')));
  v_phone text := trim(coalesce(p_data ->> 'ownerPhone', ''));
  v_country text := coalesce(nullif(trim(p_data ->> 'country'), ''), 'Moçambique');
  v_city text := trim(coalesce(p_data ->> 'city', ''));
  v_status text := coalesce(nullif(trim(p_data ->> 'subscriptionStatus'), ''), 'trial');
  v_notes text := trim(coalesce(p_data ->> 'internalNotes', ''));
  v_start timestamptz;
  v_renewal timestamptz;
  v_custom_price numeric;
  v_custom_features jsonb := case when jsonb_typeof(p_data -> 'customFeatures') = 'array' then p_data -> 'customFeatures' end;
  v_custom_limits jsonb := case when jsonb_typeof(p_data -> 'customLimits') = 'array' then p_data -> 'customLimits' end;
  v_plan public.plans;
  v_trial_days integer;
  v_company_id uuid;
  v_restaurant_id uuid;
  v_invitation_id uuid;
begin
  if not private.is_super_admin() then
    raise exception 'Apenas a equipa TapMenu pode registar estabelecimentos.' using errcode = '42501', hint = 'forbidden';
  end if;
  if v_establishment = '' or v_company = '' or v_owner = '' then
    raise exception 'Indique o nome do estabelecimento, da entidade proprietária e do responsável.' using hint = 'validation';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Indique um email válido para o responsável.' using hint = 'validation';
  end if;
  if v_status not in ('trial', 'active', 'suspended', 'expired', 'cancelled') then
    raise exception 'Estado da subscrição inválido.' using hint = 'validation';
  end if;
  if exists (select 1 from public.staff_members m where lower(m.email) = v_email) then
    raise exception 'Este email já está associado a um estabelecimento. Use outro email para o responsável.' using hint = 'email_in_use';
  end if;

  begin
    v_start := coalesce(nullif(trim(p_data ->> 'startDate'), '')::date, current_date)::timestamptz;
    v_custom_price := nullif(trim(p_data ->> 'customPrice'), '')::numeric;
  exception when others then
    raise exception 'Data de início ou preço inválidos.' using hint = 'validation';
  end;
  if v_custom_price < 0 then
    raise exception 'O preço não pode ser negativo.' using hint = 'validation';
  end if;

  select * into v_plan from public.plans where id = private.try_uuid(p_data ->> 'planId');
  if not found then
    raise exception 'Selecione um plano válido.' using hint = 'plan_not_found';
  end if;
  if not v_plan.active then
    raise exception 'O plano selecionado está inativo.' using hint = 'plan_inactive';
  end if;

  select coalesce(nullif(c.trial_days, 0), 14) into v_trial_days from public.platform_config c where c.id;
  v_renewal := case
    when v_status = 'trial' then v_start + make_interval(days => v_trial_days)
    when v_plan.billing_period = 'yearly' then v_start + interval '1 year'
    else v_start + interval '1 month'
  end;

  perform set_config('tapmenu.trusted', 'on', true);

  insert into public.companies (name, legal_name, slug, phone, email, created_by)
  values (v_company, v_company, '', v_phone, v_email, v_uid)
  returning id into v_company_id;

  insert into public.subscriptions (company_id, plan_id, status, start_date, renewal_date,
                                    custom_price, custom_features, custom_limits)
  values (v_company_id, v_plan.id, v_status, v_start, v_renewal, v_custom_price, v_custom_features, v_custom_limits);

  insert into public.restaurants (company_id, name, slug, phone, email, address, onboarding_completed_at)
  values (v_company_id, v_establishment, '', v_phone, v_email,
          jsonb_build_object('street', '', 'city', v_city, 'province', '', 'country', v_country), null)
  returning id into v_restaurant_id;

  insert into public.staff_members (company_id, name, email, phone, role, restaurant_ids)
  values (v_company_id, v_owner, v_email, v_phone, 'company_owner', array[v_restaurant_id]);

  insert into public.establishment_invitations (company_id, restaurant_id, owner_name, owner_email, owner_phone,
                                                country, city, internal_notes, created_by)
  values (v_company_id, v_restaurant_id, v_owner, v_email, v_phone, v_country, v_city, v_notes, v_uid)
  returning id into v_invitation_id;

  perform set_config('tapmenu.trusted', 'off', true);

  insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
  values (v_company_id, v_uid, private.actor_name(), 'establishment.preregistered', 'Establishment: ' || v_establishment,
          format('Pré-registo com o plano %s; responsável %s.', v_plan.name, v_email));

  return v_invitation_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Primeiro acesso do responsável
-- ---------------------------------------------------------------------
/**
 * Chamado depois de o responsável definir a palavra-passe: liga a conta ao
 * estabelecimento (email confirmado pelo convite), retira a obrigação de
 * mudar a palavra-passe e marca o convite como aceite.
 */
create or replace function public.complete_first_access()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
begin
  if v_uid is null then
    raise exception 'Inicie sessão para continuar.' using errcode = '42501', hint = 'not_authenticated';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  perform public.claim_staff_invitations();
  update public.profiles set must_change_password = false where id = v_uid and must_change_password;
  update public.establishment_invitations
  set status = 'accepted', accepted_at = coalesce(accepted_at, now()), user_id = v_uid
  where lower(owner_email) = v_email and status <> 'accepted';
  return true;
end;
$$;

/** Conclui o assistente de configuração inicial do restaurante. */
create or replace function public.complete_restaurant_onboarding(p_restaurant_id uuid)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant public.restaurants;
begin
  if not private.has_restaurant_access(p_restaurant_id, 40) then
    raise exception 'Sem permissão para configurar este estabelecimento.' using errcode = '42501', hint = 'forbidden';
  end if;
  select * into v_restaurant from public.restaurants where id = p_restaurant_id;
  if coalesce(trim(v_restaurant.name), '') = '' then
    raise exception 'Indique o nome comercial do estabelecimento.' using hint = 'validation';
  end if;
  update public.restaurants
  set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = p_restaurant_id
  returning * into v_restaurant;
  insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
  values (v_restaurant.company_id, (select auth.uid()), private.actor_name(), 'establishment.onboarded',
          'Restaurant: ' || v_restaurant.name, 'Configuração inicial concluída.');
  return v_restaurant;
end;
$$;

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
revoke execute on function
  public.admin_preregister_establishment(jsonb),
  public.complete_first_access(),
  public.complete_restaurant_onboarding(uuid)
from public, anon;
grant execute on function
  public.admin_preregister_establishment(jsonb),
  public.complete_first_access(),
  public.complete_restaurant_onboarding(uuid)
to authenticated;
