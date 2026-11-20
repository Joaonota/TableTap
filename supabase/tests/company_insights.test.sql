-- =====================================================================
-- Testes: empresa com vários estabelecimentos (migração 1900).
--
-- Executar com:  npm run test:db -- company_insights
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create schema tests;
create table tests.ids (key text primary key, id uuid);
create table tests.results (n serial, name text, ok boolean, detail text);
grant usage on schema tests to anon, authenticated;
grant all on all tables in schema tests to anon, authenticated;
grant all on all sequences in schema tests to anon, authenticated;

create function tests.id(p_key text) returns uuid language sql stable as $$ select id from tests.ids where key = p_key $$;
create function tests.put(p_key text, p_id uuid) returns uuid language sql as $$
  insert into tests.ids values (p_key, p_id) on conflict (key) do update set id = excluded.id returning id $$;
create function tests.ok(p_name text, p_cond boolean, p_detail text default null) returns void language sql as $$
  insert into tests.results (name, ok, detail) values (p_name, coalesce(p_cond, false), p_detail) $$;
create function tests.login(p_key text) returns void language sql as $$
  select set_config('request.jwt.claims',
    case when p_key is null then '{"role":"anon"}'
         else json_build_object('sub', tests.id(p_key), 'role', 'authenticated')::text end, false) $$;
/** Executa SQL e devolve o hint do erro ('' se não falhar). */
create function tests.error_hint(p_sql text) returns text language plpgsql as $$
declare v_hint text;
begin
  execute p_sql;
  return '';
exception when others then
  get stacked diagnostics v_hint = pg_exception_hint;
  return coalesce(nullif(v_hint, ''), sqlstate);
end $$;
/** Conta da sessão vista por um participante (anónimo). */
create function tests.bill(p_sess text, p_tok text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform tests.login(null);
  v := public.get_session_bill(tests.id(p_sess), tests.id(p_tok));
  return v;
end $$;
create function tests.person(p_bill jsonb, p_name text) returns jsonb language sql immutable as $$
  select e from jsonb_array_elements(p_bill -> 'participants') e where e ->> 'name' = p_name limit 1 $$;
create function tests.pay(p_sess text, p_tok text, p_mode text, p_items jsonb default null) returns jsonb language plpgsql as $$
begin
  perform tests.login(null);
  return public.create_session_payment(tests.id(p_sess), tests.id(p_tok), p_mode, 'mpesa', p_items);
end $$;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------
-- Empresas A e B, um estabelecimento cada
-- ---------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  (tests.put('super',  gen_random_uuid()), 'super@tapmenu.test',  now(), '{"full_name":"Super Admin"}'),
  (tests.put('ownerA', gen_random_uuid()), 'dono@empresa-a.test', now(), '{"full_name":"Dono A"}'),
  (tests.put('ownerB', gen_random_uuid()), 'dono@empresa-b.test', now(), '{"full_name":"Dono B"}');
update public.profiles set is_super_admin = true where id = tests.id('super');

select tests.login('super');
set role authenticated;
with p as (insert into public.plans (name, slug, price, features, limits) values
  ('Profissional', 'profissional', 4990,
   '[{"featureKey":"MENU_DIGITAL","enabled":true},{"featureKey":"NFC","enabled":true},{"featureKey":"MENU_CUSTOMIZATION","enabled":true}]',
   '[]') returning id)
select tests.put('plan', id) from p;
update public.platform_config set default_plan_id = tests.id('plan');
select tests.put('invA', public.admin_preregister_company(jsonb_build_object(
  'companyName', 'Sabores, Lda', 'commercialName', 'Sabores',
  'ownerName', 'Dono A', 'ownerEmail', 'dono@empresa-a.test', 'planId', tests.id('plan'))));
select tests.put('invB', public.admin_preregister_company(jsonb_build_object(
  'companyName', 'Casa B, Lda', 'commercialName', 'Casa B',
  'ownerName', 'Dono B', 'ownerEmail', 'dono@empresa-b.test', 'planId', tests.id('plan'))));
reset role;
select tests.put('companyA', company_id) from public.establishment_invitations where id = tests.id('invA');
select tests.put('companyB', company_id) from public.establishment_invitations where id = tests.id('invB');
select tests.login('ownerA'); set role authenticated;
select public.complete_first_access();
select public.complete_company_onboarding(tests.id('companyA'));
reset role;
select tests.login('ownerB'); set role authenticated;
select public.complete_first_access();
select public.complete_company_onboarding(tests.id('companyB'));
reset role;


-- Empresa A: Centro e Praia (mesmo menu de base só no Centro). Empresa B: um estabelecimento.
insert into public.restaurants (company_id, name, slug) values (tests.id('companyA'), 'Centro', '') returning tests.put('rCentro', id);
insert into public.restaurants (company_id, name, slug) values (tests.id('companyA'), 'Praia', '') returning tests.put('rPraia', id);
insert into public.restaurants (company_id, name, slug) values (tests.id('companyB'), 'Casa B', '') returning tests.put('rB', id);
insert into public.dining_tables (restaurant_id, number) values (tests.id('rCentro'), '01') returning tests.put('tC1', id);
insert into public.dining_tables (restaurant_id, number) values (tests.id('rCentro'), '02') returning tests.put('tC2', id);
insert into public.dining_tables (restaurant_id, number) values (tests.id('rPraia'), '01') returning tests.put('tP1', id);
insert into public.dining_tables (restaurant_id, number) values (tests.id('rB'), '01') returning tests.put('tB1', id);
insert into public.categories (restaurant_id, name) values (tests.id('rCentro'), 'Pratos') returning tests.put('catC', id);
insert into public.categories (restaurant_id, name) values (tests.id('rCentro'), 'Bebidas') returning tests.put('catCB', id);
insert into public.categories (restaurant_id, name) values (tests.id('rPraia'), 'pratos') returning tests.put('catP', id);
insert into public.categories (restaurant_id, name) values (tests.id('rB'), 'Tudo') returning tests.put('catB', id);
insert into public.products (restaurant_id, category_id, name, price) values (tests.id('rCentro'), tests.id('catC'), 'Frango', 500) returning tests.put('pFrangoC', id);
insert into public.products (restaurant_id, category_id, name, price) values (tests.id('rCentro'), tests.id('catCB'), 'Sumo', 100) returning tests.put('pSumoC', id);
insert into public.products (restaurant_id, category_id, name, price) values (tests.id('rPraia'), tests.id('catP'), 'frango', 450) returning tests.put('pFrangoP', id);
insert into public.products (restaurant_id, category_id, name, price) values (tests.id('rB'), tests.id('catB'), 'Frango', 999) returning tests.put('pFrangoB', id);
insert into public.product_variants (product_id, restaurant_id, name, price_delta) values (tests.id('pSumoC'), tests.id('rCentro'), 'Grande', 50);

create function tests.session(p_table text, p_name text, p_sess text, p_tok text) returns void language plpgsql as $$
declare v jsonb;
begin
  perform tests.login(null);
  v := public.start_table_session(tests.id(p_table), p_name);
  perform tests.put(p_sess, (v -> 'session' ->> 'id')::uuid);
  perform tests.put(p_tok, (v -> 'participant' ->> 'token')::uuid);
end $$;
create function tests.order(p_sess text, p_tok text, p_key text, p_prod text, p_qty int) returns void language plpgsql as $$
begin
  perform tests.login(null);
  perform tests.put(p_key, (public.place_order(tests.id(p_sess), tests.id(p_tok),
    jsonb_build_array(jsonb_build_object('productId', tests.id(p_prod), 'quantity', p_qty))) ->> 'id')::uuid);
end $$;

set role anon;
select tests.session('tC1', 'Ana', 'sC1', 'tkC1');
select tests.session('tP1', 'Rui', 'sP1', 'tkP1');
select tests.session('tB1', 'Eva', 'sB1', 'tkB1');
reset role;
-- Centro: 6 pedidos (5 × frango, 1 × sumo). Praia: 2 pedidos. B: 1 pedido.
set role anon;
select tests.order('sC1', 'tkC1', 'oC' || g, 'pFrangoC', 1) from generate_series(1, 5) g;
select tests.order('sC1', 'tkC1', 'oC6', 'pSumoC', 2);
select tests.order('sC1', 'tkC1', 'oC7', 'pFrangoC', 2);
select tests.order('sP1', 'tkP1', 'oP1', 'pFrangoP', 2);
select tests.order('sP1', 'tkP1', 'oP2', 'pFrangoP', 1);
select tests.order('sB1', 'tkB1', 'oB1', 'pFrangoB', 1);
reset role;

-- O Dono A cancela 3 pedidos do Centro (2 depois de irem para a cozinha) e paga/reembolsa outros.
select tests.login('ownerA'); set role authenticated;
select public.update_order_status(tests.id('oC1'), 'preparing');
select public.update_order_status(tests.id('oC1'), 'cancelled');
select public.update_order_status(tests.id('oC2'), 'ready');
select public.update_order_status(tests.id('oC2'), 'cancelled');
select public.update_order_status(tests.id('oC3'), 'cancelled');
select public.update_order_status(id, 'delivered') from public.orders where id in (tests.id('oC4'), tests.id('oC5'), tests.id('oC6'), tests.id('oC7'), tests.id('oP1'), tests.id('oP2'));
update public.orders set payment_status = 'paid' where id in (tests.id('oC4'), tests.id('oC5'), tests.id('oC6'), tests.id('oP1'));
update public.payments set status = 'refunded' where order_id in (tests.id('oC4'), tests.id('oC5'), tests.id('oC6'));
-- Praia: mesa encerrada à força com o oP2 entregue e por pagar.
select public.close_table_session(tests.id('sP1'), true, 'Cliente saiu sem pagar');
reset role;
-- Pagamento registado abaixo do total (diferença entre pagamento e pedido).
update public.payments set amount = 500 where order_id = tests.id('oP1');

-- ---------------------------------------------------------------------
-- 1. Visão consolidada
-- ---------------------------------------------------------------------
create function tests.overview() returns jsonb language plpgsql as $$
begin
  perform tests.login('ownerA');
  set local role authenticated;
  return public.get_company_overview(tests.id('companyA'), now() - interval '1 day', now() + interval '1 minute');
end $$;
select tests.ok('consolidado: faturação de todas as localizações, sem cancelados nem reembolsados (Centro 1000 + Praia 1350)',
  (select (tests.overview() -> 'totals' ->> 'revenue')::numeric = 2350));
reset role;
select tests.ok('comparação: cada localização com pedidos, cancelados e ticket médio',
  (select (r ->> 'orders')::int = 1 and (r ->> 'cancelled')::int = 3 and (r ->> 'refunds')::int = 3 and (r ->> 'averageTicket')::numeric = 1000
          and (r ->> 'cancellationRate')::numeric = 75
   from jsonb_array_elements(tests.overview() -> 'restaurants') r where r ->> 'name' = 'Centro'));
reset role;
select tests.ok('ordenado por faturação (Praia primeiro) e sem a empresa B',
  (select (tests.overview() -> 'restaurants' -> 0 ->> 'name') = 'Praia'
      and jsonb_array_length(tests.overview() -> 'restaurants') = 2));
reset role;
select tests.ok('produtos agrupados pelo nome entre localizações (Frango: Centro + Praia)',
  (select (p ->> 'quantity')::int = 5 and jsonb_array_length(p -> 'byRestaurant') = 2
   from jsonb_array_elements(tests.overview() -> 'products') p where lower(p ->> 'name') = 'frango'));
reset role;
select tests.ok('outra empresa não vê a visão da empresa A',
  tests.error_hint(format($q$select set_config('request.jwt.claims', %L, true); set local role authenticated;
    select public.get_company_overview(%L, now() - interval '1 day', now())$q$,
    json_build_object('sub', tests.id('ownerB'), 'role', 'authenticated')::text, tests.id('companyA'))) = 'forbidden');
select tests.ok('período inválido é recusado',
  tests.error_hint(format($q$select set_config('request.jwt.claims', %L, true); set local role authenticated;
    select public.get_company_overview(%L, now(), now() - interval '1 day')$q$,
    json_build_object('sub', tests.id('ownerA'), 'role', 'authenticated')::text, tests.id('companyA'))) = 'invalid_period');

-- ---------------------------------------------------------------------
-- 2. Situações incomuns
-- ---------------------------------------------------------------------
create function tests.alerts() returns jsonb language plpgsql as $$
begin
  perform tests.login('ownerA');
  set local role authenticated;
  return public.get_company_alerts(tests.id('companyA'), now() - interval '1 day', now() + interval '1 minute');
end $$;
create function tests.alert(p_kind text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  select a into v from jsonb_array_elements(tests.alerts()) a where a ->> 'kind' = p_kind limit 1;
  reset role;
  return v;
end $$;
select tests.ok('muitos cancelamentos pela mesma pessoa (3 no Centro, por Dono A)',
  (select (a ->> 'count')::int = 3 and a ->> 'actor' = 'Dono A' and a ->> 'restaurantName' = 'Centro'
   from (select tests.alert('cancellations_by_staff') a) x));
select tests.ok('cancelados depois de preparados (2)',
  (select (tests.alert('cancelled_after_preparation') ->> 'count')::int = 2));
select tests.ok('reembolsos frequentes (3 no Centro) com quem reembolsou',
  (select (a ->> 'count')::int = 3 and a ->> 'actor' like '%Dono A%' from (select tests.alert('frequent_refunds') a) x));
select tests.ok('diferença entre pagamento e pedido (oP1: 900 pedido, 500 recebido)',
  (select (a ->> 'amount')::numeric = 400 and (a ->> 'count')::int = 1 from (select tests.alert('payment_mismatch') a) x));
select tests.ok('entregue numa mesa encerrada sem pagamento (oP2, 450)',
  (select (tests.alert('delivered_unpaid') ->> 'amount')::numeric = 450));
select tests.ok('mesa encerrada à força com valores por pagar',
  (select (a ->> 'count')::int = 1 and (a ->> 'amount')::numeric = 450 from (select tests.alert('forced_close') a) x));
select tests.ok('alertas não incluem a empresa B',
  (select bool_and(a ->> 'restaurantName' in ('Centro', 'Praia')) from jsonb_array_elements(tests.alerts()) a));
reset role;

-- ---------------------------------------------------------------------
-- 3. Distribuir menu
-- ---------------------------------------------------------------------
select tests.login('ownerA'); set role authenticated;
select tests.put('copy1', null) from (select public.copy_menu_to_restaurants(tests.id('rCentro'), array[tests.id('rPraia')]) as r) x;
reset role;
select tests.ok('copiar: categoria com o mesmo nome é reutilizada; nova categoria criada',
  (select count(*) = 2 from public.categories where restaurant_id = tests.id('rPraia'))
  and exists (select 1 from public.categories where restaurant_id = tests.id('rPraia') and name = 'Bebidas'));
select tests.ok('copiar: produto que já existe não é duplicado nem alterado; novo produto copiado com variantes',
  (select count(*) = 1 and min(price) = 450 from public.products where restaurant_id = tests.id('rPraia') and lower(name) = 'frango')
  and exists (select 1 from public.products p join public.product_variants v on v.product_id = p.id
              where p.restaurant_id = tests.id('rPraia') and p.name = 'Sumo' and v.name = 'Grande' and v.restaurant_id = tests.id('rPraia')));
select tests.login('ownerA'); set role authenticated;
select public.copy_menu_to_restaurants(tests.id('rCentro'), array[tests.id('rPraia')], null, true);
reset role;
select tests.ok('copiar com "actualizar existentes": o preço passa a ser o da origem',
  (select price = 500 from public.products where id = tests.id('pFrangoP')));
select tests.ok('não se copia para outra empresa',
  tests.error_hint(format($q$select set_config('request.jwt.claims', %L, true); set local role authenticated;
    select public.copy_menu_to_restaurants(%L, array[%L]::uuid[])$q$,
    json_build_object('sub', tests.id('ownerA'), 'role', 'authenticated')::text, tests.id('rCentro'), tests.id('rB'))) = 'forbidden');

-- ---------------------------------------------------------------------
-- 4. Campanha de preço em todos os estabelecimentos
-- ---------------------------------------------------------------------
select tests.login('ownerA'); set role authenticated;
select public.apply_company_promotion(tests.id('companyA'), array['FRANGO'], 20);
reset role;
select tests.ok('campanha: -20% no Frango de todas as localizações da empresa (e não na B)',
  (select bool_and(is_promotion and promotional_price = 400) from public.products where id in (tests.id('pFrangoC'), tests.id('pFrangoP')))
  and (select promotional_price is null from public.products where id = tests.id('pFrangoB')));
select tests.login('ownerA'); set role authenticated;
select public.end_company_promotion(tests.id('companyA'), array['frango']);
reset role;
select tests.ok('terminar campanha repõe o preço normal',
  (select bool_and(not is_promotion and promotional_price is null) from public.products where id in (tests.id('pFrangoC'), tests.id('pFrangoP'))));
select tests.ok('desconto inválido é recusado',
  tests.error_hint(format($q$select set_config('request.jwt.claims', %L, true); set local role authenticated;
    select public.apply_company_promotion(%L, array['Frango'], 150)$q$,
    json_build_object('sub', tests.id('ownerA'), 'role', 'authenticated')::text, tests.id('companyA'))) = 'invalid_discount');
select tests.ok('clientes (anon) não acedem',
  tests.error_hint(format($q$set local role anon; select public.get_company_alerts(%L, now() - interval '1 day', now())$q$, tests.id('companyA'))) = '42501');
select tests.ok('distribuição e campanha ficam na auditoria',
  exists (select 1 from public.audit_logs where action = 'menu.distributed')
  and exists (select 1 from public.audit_logs where action = 'promotion.applied')
  and exists (select 1 from public.audit_logs where action = 'promotion.ended'));

-- ---------------------------------------------------------------------
-- Resultado
-- ---------------------------------------------------------------------
\pset format unaligned
\pset tuples_only on
select case when ok then 'PASS  ' else 'FAIL  ' end || name || case when not ok and detail is not null then '  — ' || detail else '' end
from tests.results order by n;
select format('%s/%s testes passaram.', count(*) filter (where ok), count(*)) from tests.results;
do $$ begin
  if exists (select 1 from tests.results where not ok) then
    raise exception 'Há testes da base de dados a falhar.';
  end if;
end $$;
