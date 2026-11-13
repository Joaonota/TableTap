-- =====================================================================
-- TapMenu — 0800 · Funcionalidades do plano aplicadas na base de dados
--
-- Até aqui só os LIMITES do plano eram aplicados no servidor (triggers
-- enforce_plan_limit). As FUNCIONALIDADES (plans.features) só eram
-- verificadas na interface, por isso um plano sem "Personalização do Menu"
-- conseguia gravar tema e layout.
--
-- private.plan_has_feature() usa o plano efetivo (plano + condições
-- ajustadas da subscrição) e serve para qualquer funcionalidade nova.
-- =====================================================================

create or replace function private.plan_has_feature(p_company_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (f ->> 'enabled')::boolean
    from jsonb_array_elements((private.effective_plan(p_company_id)).features) f
    where f ->> 'featureKey' = p_feature
    limit 1
  ), false)
$$;

/** Bloqueia uma escrita quando o plano da empresa não inclui a funcionalidade. */
create or replace function private.enforce_plan_feature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feature text := tg_argv[0];
  v_label text := coalesce(tg_argv[1], tg_argv[0]);
begin
  if private.is_super_admin() or private.plan_has_feature(new.company_id, v_feature) then
    return new;
  end if;
  raise exception 'A funcionalidade "%" não está incluída no plano da sua empresa. Mude de plano para a utilizar.', v_label
    using errcode = '42501', hint = 'feature_not_in_plan';
end;
$$;

-- Personalização do menu: gravar tema/layout exige MENU_CUSTOMIZATION.
-- Repor o padrão apaga o registo (DELETE), permitido em qualquer plano.
create trigger enforce_plan_feature before insert or update on public.menu_customizations
  for each row execute function private.enforce_plan_feature('MENU_CUSTOMIZATION', 'Personalização do Menu');

revoke execute on function private.plan_has_feature(uuid, text), private.enforce_plan_feature() from public, anon;
grant execute on function private.plan_has_feature(uuid, text) to authenticated;
