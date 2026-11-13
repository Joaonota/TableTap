-- =====================================================================
-- TapMenu — 0600 · Adesão ao nível da EMPRESA
--
-- Hierarquia: EMPRESA → PLANO → ESTABELECIMENTOS → MESAS → TAGS NFC → MENU
--
--   1. O Super Admin pré-regista a EMPRESA (não o estabelecimento):
--      dados da empresa, responsável, plano, data de início e estado da
--      conta (admin_preregister_company).
--   2. O responsável recebe o convite, define a palavra-passe e, no
--      primeiro acesso, completa o PERFIL DA EMPRESA
--      (complete_company_onboarding).
--   3. Depois cria os seus estabelecimentos no painel, dentro dos limites
--      do plano (já aplicados pelo trigger enforce_plan_limit 'RESTAURANTS').
--
-- Substitui o pré-registo por estabelecimento da 0500.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Dados da empresa
-- ---------------------------------------------------------------------
alter table public.companies
  add column country text not null default 'Moçambique',
  add column province text not null default '',
  add column city text not null default '',
  add column address text not null default '',
  -- null = perfil da empresa por completar (primeiro acesso do responsável).
  -- Empresas existentes contam como completas.
  add column onboarding_completed_at timestamptz default now();

grant update (country, province, city, address) on public.companies to authenticated;

alter table public.establishment_invitations
  add column province text not null default '';
grant update (province) on public.establishment_invitations to authenticated;

-- ---------------------------------------------------------------------
-- 2. Pré-registo da empresa (Super Admin)
-- ---------------------------------------------------------------------
drop function if exists public.admin_preregister_establishment(jsonb);

/**
 * Cria, numa só transação: empresa, subscrição (com condições ajustadas
 * opcionais), ligação do responsável como dono (pendente até ele entrar)
 * e o registo interno do pré-registo. Nenhum estabelecimento é criado:
 * é o responsável quem os cria, dentro dos limites do plano.
 *
 * p_data: { companyName, commercialName, ownerName, ownerEmail, ownerPhone,
 *           country, province, city, planId, subscriptionStatus,
 *           startDate (AAAA-MM-DD), accountActive, internalNotes,
 *           customPrice?, customFeatures?, customLimits? }
 * Devolve o id do pré-registo (establishment_invitations).
 */
create or replace function public.admin_preregister_company(p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_company text := trim(coalesce(p_data ->> 'companyName', ''));
  v_commercial text := trim(coalesce(p_data ->> 'commercialName', ''));
  v_owner text := trim(coalesce(p_data ->> 'ownerName', ''));
  v_email text := lower(trim(coalesce(p_data ->> 'ownerEmail', '')));
  v_phone text := trim(coalesce(p_data ->> 'ownerPhone', ''));
  v_country text := coalesce(nullif(trim(p_data ->> 'country'), ''), 'Moçambique');
  v_province text := trim(coalesce(p_data ->> 'province', ''));
  v_city text := trim(coalesce(p_data ->> 'city', ''));
  v_status text := coalesce(nullif(trim(p_data ->> 'subscriptionStatus'), ''), 'trial');
  v_active boolean := coalesce((p_data ->> 'accountActive')::boolean, true);
  v_notes text := trim(coalesce(p_data ->> 'internalNotes', ''));
  v_start timestamptz;
  v_renewal timestamptz;
  v_custom_price numeric;
  v_custom_features jsonb := case when jsonb_typeof(p_data -> 'customFeatures') = 'array' then p_data -> 'customFeatures' end;
  v_custom_limits jsonb := case when jsonb_typeof(p_data -> 'customLimits') = 'array' then p_data -> 'customLimits' end;
  v_plan public.plans;
  v_trial_days integer;
  v_company_id uuid;
  v_invitation_id uuid;
begin
  if not private.is_super_admin() then
    raise exception 'Apenas a equipa TapMenu pode registar empresas.' using errcode = '42501', hint = 'forbidden';
  end if;
  if v_commercial = '' then v_commercial := v_company; end if;
  if v_company = '' or v_owner = '' then
    raise exception 'Indique o nome da empresa e do responsável.' using hint = 'validation';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Indique um email válido para o responsável.' using hint = 'validation';
  end if;
  if v_status not in ('trial', 'active', 'suspended', 'expired', 'cancelled') then
    raise exception 'Estado da subscrição inválido.' using hint = 'validation';
  end if;
  if exists (select 1 from public.staff_members m where lower(m.email) = v_email) then
    raise exception 'Este email já está associado a uma empresa. Use outro email para o responsável.' using hint = 'email_in_use';
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

  insert into public.companies (name, legal_name, slug, phone, email, country, province, city,
                                is_active, onboarding_completed_at, created_by)
  values (v_commercial, v_company, '', v_phone, v_email, v_country, v_province, v_city,
          v_active, null, v_uid)
  returning id into v_company_id;

  insert into public.subscriptions (company_id, plan_id, status, start_date, renewal_date,
                                    custom_price, custom_features, custom_limits)
  values (v_company_id, v_plan.id, v_status, v_start, v_renewal, v_custom_price, v_custom_features, v_custom_limits);

  -- Dono: acesso a todos os estabelecimentos da empresa (restaurant_ids vazio).
  insert into public.staff_members (company_id, name, email, phone, role, restaurant_ids)
  values (v_company_id, v_owner, v_email, v_phone, 'company_owner', '{}');

  insert into public.establishment_invitations (company_id, owner_name, owner_email, owner_phone,
                                                country, province, city, internal_notes, created_by)
  values (v_company_id, v_owner, v_email, v_phone, v_country, v_province, v_city, v_notes, v_uid)
  returning id into v_invitation_id;

  perform set_config('tapmenu.trusted', 'off', true);

  insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
  values (v_company_id, v_uid, private.actor_name(), 'company.preregistered', 'Company: ' || v_commercial,
          format('Pré-registo com o plano %s; responsável %s.', v_plan.name, v_email));

  return v_invitation_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Primeiro acesso: perfil da empresa
-- ---------------------------------------------------------------------
/** Conclui o perfil da empresa (o responsável grava os dados antes, por update). */
create or replace function public.complete_company_onboarding(p_company_id uuid)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  if not private.has_company_access(p_company_id, 50) then
    raise exception 'Sem permissão para configurar esta empresa.' using errcode = '42501', hint = 'forbidden';
  end if;
  select * into v_company from public.companies where id = p_company_id;
  if coalesce(trim(v_company.name), '') = '' then
    raise exception 'Indique o nome comercial da empresa.' using hint = 'validation';
  end if;
  update public.companies
  set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = p_company_id
  returning * into v_company;
  insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
  values (p_company_id, (select auth.uid()), private.actor_name(), 'company.onboarded',
          'Company: ' || v_company.name, 'Perfil da empresa concluído.');
  return v_company;
end;
$$;

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------
revoke execute on function public.admin_preregister_company(jsonb), public.complete_company_onboarding(uuid)
  from public, anon;
grant execute on function public.admin_preregister_company(jsonb), public.complete_company_onboarding(uuid)
  to authenticated;
