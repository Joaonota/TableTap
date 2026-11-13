-- =====================================================================
-- Testes da base de dados: isolamento entre empresas, RLS, papéis,
-- limites de planos, sessões, pedidos, pagamentos, NFC e Storage.
--
-- Executar com:  npm run test:db   (ver scripts/test-database.mjs)
-- Cada utilizador é simulado como o Supabase faz: role `authenticated`
-- (ou `anon`) + claims do JWT em request.jwt.claims.
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
grant execute on all functions in schema tests to anon, authenticated;

-- Contas (o Supabase Auth cria-as; aqui inserimos diretamente)
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  (tests.put('super', gen_random_uuid()), 'super@tapmenu.test', now(), '{"full_name":"Equipa TapMenu"}'),
  (tests.put('ownerA', gen_random_uuid()), 'dono.a@empresa-a.test', now(), '{"full_name":"Dono A"}'),
  (tests.put('ownerB', gen_random_uuid()), 'dono.b@empresa-b.test', now(), '{"full_name":"Dono B"}'),
  (tests.put('managerA', gen_random_uuid()), 'gerente@empresa-a.test', now(), '{"full_name":"Gerente A"}'),
  (tests.put('waiterA', gen_random_uuid()), 'garcom@empresa-a.test', now(), '{"full_name":"Garçom A"}'),
  (tests.put('unconfirmed', gen_random_uuid()), 'falso@empresa-a.test', null, '{"full_name":"Sem confirmação"}');
-- Primeiro Super Admin: definido diretamente na base de dados (nunca pela aplicação).
update public.profiles set is_super_admin = true where id = tests.id('super');

select tests.ok('perfil criado automaticamente no registo', (select count(*) = 6 from public.profiles));

-- ---------------------------------------------------------------------
-- 1. Planos (Super Admin)
-- ---------------------------------------------------------------------
select tests.login('ownerA');
set role authenticated;
do $$ begin
  insert into public.plans (name, slug, price, limits) values ('Pirata', 'pirata', 0, '[]');
  perform tests.ok('dono de empresa NÃO cria planos', false);
exception when others then perform tests.ok('dono de empresa NÃO cria planos', true, sqlerrm); end $$;
do $$ begin
  update public.profiles set is_super_admin = true where id = tests.id('ownerA');
  perform tests.ok('utilizador NÃO se promove a Super Admin', false);
exception when others then perform tests.ok('utilizador NÃO se promove a Super Admin', true, sqlerrm); end $$;
reset role;

select tests.login('super');
set role authenticated;
with p as (insert into public.plans (name, slug, price, features, limits) values
  ('Básico', 'basico', 1990,
   '[{"featureKey":"MENU_DIGITAL","enabled":true},{"featureKey":"NFC","enabled":true}]',
   '[{"resourceKey":"TABLES","limit":2},{"resourceKey":"PRODUCTS","limit":2},{"resourceKey":"CATEGORIES","limit":3},
     {"resourceKey":"STAFF","limit":3},{"resourceKey":"RESTAURANTS","limit":1}]')
  returning id) select tests.put('planBasic', id) from p;
with p as (insert into public.plans (name, slug, price, limits) values ('Premium', 'premium', 9990,
   '[{"resourceKey":"TABLES","limit":null},{"resourceKey":"PRODUCTS","limit":null}]') returning id) select tests.put('planPremium', id) from p;
update public.platform_config set default_plan_id = tests.id('planBasic');
reset role;
select tests.ok('Super Admin cria planos e define o plano por omissão',
  (select default_plan_id = tests.id('planBasic') from public.platform_config));
select tests.ok('auditoria regista a criação de planos', exists (select 1 from public.audit_logs where action = 'plan.created'));

-- ---------------------------------------------------------------------
-- 2. Registo de empresas (self-service)
-- ---------------------------------------------------------------------
select tests.login('ownerA');
set role authenticated;
select tests.put('companyA', public.register_company('Empresa A', 'Restaurante A Centro', null, '400111222', '+258840000001', 'Maputo'));
select tests.put('restA', (select id from public.restaurants limit 1));
do $$ begin
  perform public.register_company('Outra', 'Outro');
  perform tests.ok('mesma conta NÃO regista segunda empresa', false);
exception when others then perform tests.ok('mesma conta NÃO regista segunda empresa', true, sqlerrm); end $$;
reset role;

select tests.login('ownerB');
set role authenticated;
select tests.put('companyB', public.register_company('Empresa B', 'Restaurante B', null, null, null, 'Beira'));
select tests.put('restB', (select id from public.restaurants limit 1));
reset role;

select tests.ok('registo cria empresa, dono, subscrição em teste e restaurante',
  (select count(*) = 1 from public.staff_members where company_id = tests.id('companyA') and role = 'company_owner' and user_id = tests.id('ownerA'))
  and (select status = 'trial' from public.subscriptions where company_id = tests.id('companyA'))
  and (select count(*) = 1 from public.restaurants where company_id = tests.id('companyA')));
select tests.ok('slug do restaurante gerado sem acentos', (select slug = 'restaurante-a-centro' from public.restaurants where id = tests.id('restA')));

-- ---------------------------------------------------------------------
-- 3. Isolamento entre empresas
-- ---------------------------------------------------------------------
select tests.login('ownerA');
set role authenticated;
select tests.ok('A só vê a sua empresa', (select count(*) = 1 from public.companies) and (select id = tests.id('companyA') from public.companies));
select tests.ok('A não vê restaurantes de B', not exists (select 1 from public.restaurants where id = tests.id('restB')));
select tests.ok('A não vê a subscrição de B', (select count(*) = 1 from public.subscriptions));
do $$ begin
  insert into public.dining_tables (restaurant_id, number, area, capacity) values (tests.id('restB'), '1', 'Bar', 2);
  perform tests.ok('A NÃO cria mesas no restaurante de B', false);
exception when others then perform tests.ok('A NÃO cria mesas no restaurante de B', true, sqlerrm); end $$;
update public.restaurants set name = 'Hackeado' where id = tests.id('restB');
reset role;
select tests.ok('A NÃO altera o restaurante de B (0 linhas)', (select name = 'Restaurante B' from public.restaurants where id = tests.id('restB')));
select tests.login('ownerA');
set role authenticated;
do $$ begin
  perform public.get_plan_usage(tests.id('companyB'), 'TABLES', tests.id('restB'));
  perform tests.ok('A NÃO consulta o consumo de B', false);
exception when others then perform tests.ok('A NÃO consulta o consumo de B', true, sqlerrm); end $$;
do $$ begin
  update public.subscriptions set plan_id = tests.id('planPremium') where company_id = tests.id('companyA');
  perform tests.ok('dono NÃO muda o próprio plano diretamente', not exists (
    select 1 from public.subscriptions where company_id = tests.id('companyA') and plan_id = tests.id('planPremium')));
exception when others then perform tests.ok('dono NÃO muda o próprio plano diretamente', true, sqlerrm); end $$;

-- ---------------------------------------------------------------------
-- 4. Limites do plano (Básico: 2 mesas, 2 produtos, 1 restaurante)
-- ---------------------------------------------------------------------
insert into public.dining_tables (restaurant_id, number, area, capacity) values (tests.id('restA'), '01', 'Sala Principal', 4);
insert into public.dining_tables (restaurant_id, number, area, capacity) values (tests.id('restA'), '02', 'Esplanada', 2);
select tests.put('table1', id) from public.dining_tables where number = '01';
select tests.put('table2', id) from public.dining_tables where number = '02';
select tests.ok('mesa recebe slug permanente e nome', (select slug = 'mesa-01' and name = 'Mesa 01' and status = 'free' from public.dining_tables where id = tests.id('table1')));
do $$
declare v_hint text;
begin
  insert into public.dining_tables (restaurant_id, number, area, capacity) values (tests.id('restA'), '03', 'Bar', 2);
  perform tests.ok('3.ª mesa bloqueada pelo limite do plano', false);
exception when others then
  get stacked diagnostics v_hint = pg_exception_hint;
  perform tests.ok('3.ª mesa bloqueada pelo limite do plano', v_hint = 'plan_limit_reached' and sqlerrm like 'Limite do plano atingido: 2 de 2 mesas neste restaurante (plano Básico)%', sqlerrm);
end $$;
do $$ begin
  insert into public.restaurants (company_id, name, slug) values (tests.id('companyA'), 'Segundo', '');
  perform tests.ok('2.º restaurante bloqueado pelo limite', false);
exception when others then perform tests.ok('2.º restaurante bloqueado pelo limite', sqlerrm like 'Limite do plano atingido: 1 de 1 restaurantes%', sqlerrm); end $$;
do $$ begin
  insert into public.dining_tables (restaurant_id, number, area, capacity) values (tests.id('restA'), ' 01 ', 'Bar', 2);
  perform tests.ok('número de mesa duplicado recusado', false);
exception when others then perform tests.ok('número de mesa duplicado recusado', true, sqlerrm); end $$;
do $$ begin
  update public.dining_tables set status = 'occupied' where id = tests.id('table1');
  perform tests.ok('estado da mesa NÃO muda diretamente (só via sessão)', false);
exception when others then perform tests.ok('estado da mesa NÃO muda diretamente (só via sessão)', true, sqlerrm); end $$;
select tests.ok('consumo do plano', public.get_plan_usage(tests.id('companyA'), 'TABLES', tests.id('restA')) = 2);

-- Menu
insert into public.categories (restaurant_id, name, sort_order) values (tests.id('restA'), 'Pratos', 1);
select tests.put('catA', id) from public.categories where name = 'Pratos';
insert into public.products (restaurant_id, category_id, name, price, removable_ingredients) values
  (tests.id('restA'), tests.id('catA'), 'Frango', 500, '{cebola}');
insert into public.products (restaurant_id, category_id, name, price, promotional_price) values
  (tests.id('restA'), tests.id('catA'), 'Peixe', 800, 700);
select tests.put('prodChicken', id) from public.products where name = 'Frango';
select tests.put('prodFish', id) from public.products where name = 'Peixe';
insert into public.product_variants (product_id, name, price_delta) values (tests.id('prodChicken'), 'Grande', 150);
insert into public.product_addons (product_id, name, price) values (tests.id('prodChicken'), 'Batata', 100);
select tests.put('varLarge', id) from public.product_variants where name = 'Grande';
select tests.put('addonFries', id) from public.product_addons where name = 'Batata';
do $$ begin
  insert into public.products (restaurant_id, category_id, name, price) values (tests.id('restA'), tests.id('catA'), 'Terceiro', 1);
  perform tests.ok('3.º produto bloqueado pelo limite', false);
exception when others then perform tests.ok('3.º produto bloqueado pelo limite', sqlerrm like 'Limite do plano atingido: 2 de 2 produtos%', sqlerrm); end $$;
update public.restaurants set tax_rate = 10, settings = settings || '{"serviceFeePercent": 5}' where id = tests.id('restA');
reset role;

-- O Super Admin muda o plano → efeito imediato
select tests.login('super');
set role authenticated;
update public.subscriptions set plan_id = tests.id('planPremium') where company_id = tests.id('companyA');
reset role;
select tests.ok('mudança de plano regista evento', exists (
  select 1 from public.subscription_events where company_id = tests.id('companyA') and event = 'plan_changed' and to_plan_name = 'Premium'));
select tests.login('ownerA');
set role authenticated;
insert into public.dining_tables (restaurant_id, number, area, capacity) values (tests.id('restA'), '03', 'Bar', 2);
select tests.ok('plano ilimitado permite criar', (select count(*) = 3 from public.dining_tables where restaurant_id = tests.id('restA')));
reset role;

-- ---------------------------------------------------------------------
-- 5. Equipa, convites e papéis
-- ---------------------------------------------------------------------
select tests.login('ownerA');
set role authenticated;
insert into public.staff_members (company_id, name, email, role, restaurant_ids) values
  (tests.id('companyA'), 'Gerente A', 'GERENTE@empresa-a.test', 'manager', array[tests.id('restA')]),
  (tests.id('companyA'), 'Garçom A', 'garcom@empresa-a.test', 'waiter', array[tests.id('restA')]),
  (tests.id('companyA'), 'Falso', 'falso@empresa-a.test', 'waiter', array[tests.id('restA')]);
do $$ begin
  insert into public.staff_members (company_id, name, email, role, restaurant_ids) values
    (tests.id('companyA'), 'Intruso', 'x@x.test', 'waiter', array[tests.id('restB')]);
  perform tests.ok('NÃO atribui restaurantes de outra empresa', false);
exception when others then perform tests.ok('NÃO atribui restaurantes de outra empresa', true, sqlerrm); end $$;
do $$ begin
  update public.staff_members set user_id = tests.id('ownerB') where email = 'falso@empresa-a.test';
  perform tests.ok('user_id do funcionário NÃO é definido pelo cliente', false);
exception when others then perform tests.ok('user_id do funcionário NÃO é definido pelo cliente', true, sqlerrm); end $$;
reset role;

select tests.login('managerA');
set role authenticated;
select tests.ok('convite ligado ao confirmar o email', public.claim_staff_invitations() = 1);
reset role;
select tests.login('waiterA');
set role authenticated;
select public.claim_staff_invitations();
reset role;
select tests.login('unconfirmed');
set role authenticated;
select tests.ok('convite NÃO é ligado sem email confirmado', public.claim_staff_invitations() = 0);
reset role;

select tests.login('managerA');
set role authenticated;
do $$ begin
  insert into public.staff_members (company_id, name, email, role, restaurant_ids)
  values (tests.id('companyA'), 'Novo Admin', 'admin@empresa-a.test', 'restaurant_admin', array[tests.id('restA')]);
  perform tests.ok('gerente NÃO cria um papel superior ao seu', false);
exception when others then perform tests.ok('gerente NÃO cria um papel superior ao seu', true, sqlerrm); end $$;
select tests.ok('gerente vê as mesas do seu restaurante', (select count(*) = 3 from public.dining_tables));
reset role;

select tests.login('waiterA');
set role authenticated;
select tests.ok('garçom vê o menu do seu restaurante', (select count(*) = 2 from public.products));
do $$ begin
  insert into public.categories (restaurant_id, name) values (tests.id('restA'), 'Do garçom');
  perform tests.ok('garçom NÃO gere o menu', false);
exception when others then perform tests.ok('garçom NÃO gere o menu', true, sqlerrm); end $$;
reset role;

-- ---------------------------------------------------------------------
-- 6. Cliente anónimo: URL da mesa → sessão → pedido → conta
-- ---------------------------------------------------------------------
select tests.login(null);
set role anon;
select tests.ok('anónimo NÃO lê tabelas diretamente', (select count(*) = 0 from public.orders) and (select count(*) = 0 from public.restaurants));
do $$ begin
  insert into public.orders (restaurant_id, order_number, order_code) values (tests.id('restA'), 1, 'x');
  perform tests.ok('anónimo NÃO insere pedidos diretamente', false);
exception when others then perform tests.ok('anónimo NÃO insere pedidos diretamente', true, sqlerrm); end $$;
do $$ begin
  perform public.register_company('Anónima', 'Anónimo');
  perform tests.ok('anónimo NÃO executa funções da área reservada', false);
exception when insufficient_privilege then perform tests.ok('anónimo NÃO executa funções da área reservada', true, sqlerrm); end $$;
select tests.ok('URL pública resolve restaurante e mesa livre',
  (select (r -> 'table' ->> 'status') = 'free' and (r -> 'activeSession') = 'null'::jsonb
   from public.get_public_table('restaurante-a-centro', 'mesa-01') r));
select tests.ok('URL antiga resolve pelo número', public.get_public_table('restaurante-a-centro', '02') is not null);
select tests.ok('mesa inexistente devolve null', public.get_public_table('restaurante-a-centro', 'mesa-99') is null);
select tests.ok('menu público só com produtos ativos e variantes',
  (select jsonb_array_length(m -> 'products') = 2 and (m -> 'products' -> 0 -> 'variants') is not null from public.get_public_menu(tests.id('restA')) m));

create temp table s1 as select public.start_table_session(tests.id('table1'), 'Ana', 2) as r;
grant select on s1 to anon, authenticated;
select tests.put('session1', ((select r from s1) -> 'session' ->> 'id')::uuid);
select tests.put('tokenAna', ((select r from s1) -> 'participant' ->> 'token')::uuid);
select tests.ok('mesa livre → sessão iniciada com o cliente principal',
  (select (r -> 'session' ->> 'primaryCustomerName') = 'Ana' from s1));
do $$ begin
  perform public.start_table_session(tests.id('table1'), 'Bruno');
  perform tests.ok('segunda sessão na mesma mesa recusada', false);
exception when others then perform tests.ok('segunda sessão na mesma mesa recusada', sqlerrm like '%já tem uma sessão ativa%', sqlerrm); end $$;
create temp table j1 as select public.join_table_session(tests.id('session1'), 'Bruno') as r;
grant select on j1 to anon, authenticated;
select tests.put('tokenBruno', ((select r from j1) -> 'participant' ->> 'token')::uuid);
select tests.ok('mesa ocupada → outro telemóvel junta-se à mesma sessão',
  (select jsonb_array_length(r -> 'session' -> 'participants') = 2 from j1));

-- Preços calculados no servidor: 1x Frango Grande + Batata (500+150+100) + 2x Peixe promo (700)
create temp table o1 as select public.place_order(tests.id('session1'), tests.id('tokenAna'),
  jsonb_build_array(
    jsonb_build_object('productId', tests.id('prodChicken'), 'quantity', 1, 'variantId', tests.id('varLarge'),
                       'addonIds', jsonb_build_array(tests.id('addonFries')), 'removedIngredients', jsonb_build_array('cebola', 'inventado'),
                       'unitPrice', 1, 'totalPrice', 1),
    jsonb_build_object('productId', tests.id('prodFish'), 'quantity', 2)),
  null, null, 'Sem picante', 'mpesa') as r;
grant select on o1 to anon, authenticated;
select tests.put('order1', ((select r from o1) ->> 'id')::uuid);
select tests.ok('subtotal calculado no servidor (ignora preços do navegador)', (select (r ->> 'subtotal')::numeric = 2150 from o1), (select r ->> 'subtotal' from o1));
select tests.ok('IVA 10% e taxa de serviço 5%', (select (r ->> 'taxAmount')::numeric = 215 and (r ->> 'serviceFee')::numeric = 107.5 and (r ->> 'total')::numeric = 2472.5 from o1));
select tests.ok('código de pedido sequencial', (select r ->> 'orderCode' = '#ORD-1001' from o1));
select tests.ok('só remove ingredientes permitidos', (select (r -> 'items' -> 0 -> 'removedIngredients') = '["cebola"]'::jsonb from o1));
do $$ begin
  perform public.place_order(tests.id('session1'), gen_random_uuid(), jsonb_build_array(jsonb_build_object('productId', tests.id('prodFish'), 'quantity', 1)));
  perform tests.ok('pedido com token falso recusado', false);
exception when others then perform tests.ok('pedido com token falso recusado', true, sqlerrm); end $$;
do $$ begin
  perform public.place_order(tests.id('session1'), tests.id('tokenBruno'),
    jsonb_build_array(jsonb_build_object('productId', (select gen_random_uuid()), 'quantity', 1)));
  perform tests.ok('produto inexistente recusado', false);
exception when others then perform tests.ok('produto inexistente recusado', true, sqlerrm); end $$;
select public.place_order(tests.id('session1'), tests.id('tokenBruno'), jsonb_build_array(jsonb_build_object('productId', tests.id('prodFish'), 'quantity', 1)));
select tests.ok('pedido do segundo participante é adicional', (select count(*) = 2 from jsonb_array_elements(public.get_session_orders(tests.id('session1'), tests.id('tokenBruno')))));
do $$ begin
  perform public.get_session_orders(tests.id('session1'), null);
  perform tests.ok('pedidos da sessão NÃO visíveis sem token', false);
exception when others then perform tests.ok('pedidos da sessão NÃO visíveis sem token', true, sqlerrm); end $$;
select tests.ok('acompanhamento público do pedido', (select (r -> 'order' ->> 'orderCode') = '#ORD-1001' from public.get_public_order(tests.id('order1')) r));
select public.create_service_request(tests.id('table1'), 'water', tests.id('session1'), tests.id('tokenAna'), 'Ana');
select tests.ok('chamada repetida não duplica', (select (r ->> 'alreadyExisted')::boolean from public.create_service_request(tests.id('table1'), 'water') r));
select public.request_bill(tests.id('session1'), tests.id('tokenAna'), 'cash', 'NUIT 400111222');
reset role;

select tests.ok('total da sessão = soma dos pedidos', (select total = 2472.5 + 805 from public.table_sessions where id = tests.id('session1')),
  (select total::text from public.table_sessions where id = tests.id('session1')));
select tests.ok('pedir a conta cria pagamentos a aguardar confirmação',
  (select count(*) = 2 from public.payments where status = 'awaiting_confirmation')
  and (select bool_and(payment_status = 'awaiting_confirmation') from public.orders where table_session_id = tests.id('session1')));
select tests.ok('nota do pedido de conta chega à equipa',
  exists (select 1 from public.notifications where type = 'bill_requested' and message like '%Nota: NUIT 400111222%'));
select tests.ok('notificações criadas no servidor',
  (select count(*) from public.notifications where restaurant_id = tests.id('restA')) >= 4);

-- ---------------------------------------------------------------------
-- 7. Equipa opera: pedido, pagamento, sessão
-- ---------------------------------------------------------------------
select tests.login('waiterA');
set role authenticated;
select public.update_order_status(tests.id('order1'), 'preparing', 'Na cozinha');
select tests.ok('histórico do estado com autor', exists (select 1 from public.order_status_history where order_id = tests.id('order1') and status = 'preparing' and updated_by = 'Garçom A'));
update public.payments set status = 'paid' where order_id = tests.id('order1');
select tests.ok('confirmar pagamento atualiza o pedido', (select payment_status = 'paid' from public.orders where id = tests.id('order1')));
select public.update_order_status(tests.id('order1'), 'cancelled');
select tests.ok('pedido cancelado sai do total da sessão', (select total = 805 from public.table_sessions where id = tests.id('session1')));
select public.close_table_session(tests.id('session1'));
select tests.ok('encerrar sessão liberta a mesa', (select status = 'free' and active_session_id is null from public.dining_tables where id = tests.id('table1')));
reset role;
select tests.login(null);
set role anon;
do $$ begin
  perform public.place_order(tests.id('session1'), tests.id('tokenAna'), jsonb_build_array(jsonb_build_object('productId', tests.id('prodFish'), 'quantity', 1)));
  perform tests.ok('pedido numa sessão encerrada recusado', false);
exception when others then perform tests.ok('pedido numa sessão encerrada recusado', true, sqlerrm); end $$;
select tests.ok('mesa volta a estar livre na URL pública', (select (r -> 'table' ->> 'status') = 'free' from public.get_public_table('restaurante-a-centro', 'mesa-01') r));
reset role;

select tests.login('ownerB');
set role authenticated;
select tests.ok('B não vê pedidos, pagamentos nem notificações de A',
  (select count(*) = 0 from public.orders) and (select count(*) = 0 from public.payments) and (select count(*) = 0 from public.notifications));
do $$ begin
  perform public.update_order_status(tests.id('order1'), 'delivered');
  perform tests.ok('B NÃO altera pedidos de A', false);
exception when others then perform tests.ok('B NÃO altera pedidos de A', true, sqlerrm); end $$;
do $$ begin
  perform public.close_table_session(tests.id('session1'));
  perform tests.ok('B NÃO gere sessões de A', false);
exception when others then perform tests.ok('B NÃO gere sessões de A', true, sqlerrm); end $$;
reset role;

-- ---------------------------------------------------------------------
-- 8. Etiquetas NFC
-- ---------------------------------------------------------------------
select tests.login('ownerA');
set role authenticated;
do $$ begin
  perform public.nfc_register_tags(tests.id('restA'), null, 2);
  perform tests.ok('restaurante NÃO regista etiquetas (equipa TapMenu)', false);
exception when others then perform tests.ok('restaurante NÃO regista etiquetas (equipa TapMenu)', true, sqlerrm); end $$;
reset role;
select tests.login('super');
set role authenticated;
select tests.put('tag1', id) from public.nfc_register_tags(tests.id('restA'), null, 2) where code = 'TAG-00001';
reset role;
select tests.login('ownerA');
set role authenticated;
select public.nfc_assign_tag(tests.id('tag1'), tests.id('table1'));
select tests.ok('associar etiqueta guarda a URL da mesa', (select target_path = '/m/restaurante-a-centro/mesa-01' and status = 'pending' from public.nfc_tags where id = tests.id('tag1')));
do $$ begin
  perform public.nfc_mark_tag_configured(tests.id('tag1'));
  perform tests.ok('restaurante NÃO marca gravação física', false);
exception when others then perform tests.ok('restaurante NÃO marca gravação física', true, sqlerrm); end $$;
reset role;
select tests.login('super');
set role authenticated;
select public.nfc_mark_tag_configured(tests.id('tag1'), 'Gravada com app externa');
select public.nfc_activate_tag(tests.id('tag1'));
reset role;
select tests.login('ownerA');
set role authenticated;
select public.nfc_assign_tag(tests.id('tag1'), tests.id('table2'));
select tests.ok('reatribuir etiqueta gravada exige regravação', (select status = 'reassignment_pending' from public.nfc_tags where id = tests.id('tag1')));
delete from public.dining_tables where id = tests.id('table2');
select tests.ok('remover mesa desassocia a etiqueta', (select table_id is null from public.nfc_tags where id = tests.id('tag1')));
select tests.ok('histórico da etiqueta completo', (select count(*) >= 5 from public.nfc_tag_events where tag_id = tests.id('tag1')));
reset role;
select tests.login('ownerB');
set role authenticated;
select tests.ok('B não vê etiquetas de A', (select count(*) = 0 from public.nfc_tags));
reset role;

-- ---------------------------------------------------------------------
-- 9. Planos: pedido de alteração e eliminação
-- ---------------------------------------------------------------------
select tests.login('ownerB');
set role authenticated;
select public.request_plan_change(tests.id('planPremium'), 'Precisamos de mais mesas');
reset role;
select tests.login('waiterA');
set role authenticated;
do $$ begin
  perform public.request_plan_change(tests.id('planPremium'));
  perform tests.ok('garçom NÃO pede alteração de plano', false);
exception when others then perform tests.ok('garçom NÃO pede alteração de plano', true, sqlerrm); end $$;
reset role;
select tests.login('super');
set role authenticated;
update public.subscriptions set plan_id = tests.id('planPremium') where company_id = tests.id('companyB');
select tests.ok('aplicar o plano pedido aprova o pedido', (select status = 'approved' from public.plan_change_requests where company_id = tests.id('companyB')));
insert into public.subscription_events (subscription_id, company_id, event, note, performed_by)
select id, company_id, 'note', 'Desconto acordado', 'Autor forjado' from public.subscriptions where company_id = tests.id('companyB');
select tests.ok('nota da subscrição guarda o autor real (não o enviado)',
  exists (select 1 from public.subscription_events where event = 'note' and performed_by = 'Equipa TapMenu'));
do $$ begin
  delete from public.plans where id = tests.id('planPremium');
  perform tests.ok('plano em uso NÃO é eliminado', false);
exception when others then perform tests.ok('plano em uso NÃO é eliminado', sqlerrm like '%está atribuído a 2 empresa(s)%', sqlerrm); end $$;
select tests.ok('Super Admin vê todas as empresas', (select count(*) = 2 from public.companies));
reset role;

-- ---------------------------------------------------------------------
-- 10. Storage
-- ---------------------------------------------------------------------
select tests.login('ownerA');
set role authenticated;
insert into storage.objects (bucket_id, name) values ('media', tests.id('companyA') || '/' || tests.id('restA') || '/products/a.webp');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('media', tests.id('companyB') || '/' || tests.id('restB') || '/products/x.webp');
  perform tests.ok('A NÃO faz upload para a pasta de B', false);
exception when others then perform tests.ok('A NÃO faz upload para a pasta de B', true, sqlerrm); end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('media', tests.id('companyA') || '/' || tests.id('restB') || '/products/x.webp');
  perform tests.ok('A NÃO usa um restaurante de B na sua pasta', false);
exception when others then perform tests.ok('A NÃO usa um restaurante de B na sua pasta', true, sqlerrm); end $$;
reset role;
select tests.login('waiterA');
set role authenticated;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('media', tests.id('companyA') || '/' || tests.id('restA') || '/products/b.webp');
  perform tests.ok('garçom NÃO faz upload de imagens', false);
exception when others then perform tests.ok('garçom NÃO faz upload de imagens', true, sqlerrm); end $$;
reset role;
select tests.ok('upload autorizado gravado', (select count(*) = 1 from storage.objects));

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
