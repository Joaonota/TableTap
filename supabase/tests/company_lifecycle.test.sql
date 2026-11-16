-- =====================================================================
-- Testes: hierarquia Super Admin do Sistema → Empresa, suspensão e
-- eliminação permanente de empresas (migração 0900).
--
-- Executar com:  npm run test:db   (ver scripts/test-database.mjs)
-- Base de dados própria: não depende de supabase/tests/database.test.sql.
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create schema tests;
create table tests.ids (key text primary key, id uuid);
create table tests.results (n serial, name text, ok boolean, detail text);
create table tests.snapshots (key text primary key, value jsonb);
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

-- ---------------------------------------------------------------------
-- Contas
-- ---------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  (tests.put('super',    gen_random_uuid()), 'super@tapmenu.test',        now(), '{"full_name":"Super Admin"}'),
  (tests.put('ownerA',   gen_random_uuid()), 'dono@empresa-a.test',       now(), '{"full_name":"Dono A"}'),
  (tests.put('waiterA',  gen_random_uuid()), 'garcom@empresa-a.test',     now(), '{"full_name":"Garçom A"}'),
  -- Convidado pela empresa A (conta Auth criada pelo convite) mas ainda sem entrar.
  (tests.put('pendingA', gen_random_uuid()), 'pendente@empresa-a.test',   null,  '{"full_name":"Pendente A"}'),
  (tests.put('ownerB',   gen_random_uuid()), 'dono@empresa-b.test',       now(), '{"full_name":"Dono B"}'),
  (tests.put('waiterB',  gen_random_uuid()), 'garcom@empresa-b.test',     now(), '{"full_name":"Garçom B"}'),
  -- Trabalha na empresa B e foi também convidado pela A: a conta é da B e NÃO pode ser removida.
  (tests.put('shared',   gen_random_uuid()), 'partilhado@empresas.test',  now(), '{"full_name":"Partilhado"}');
update public.profiles set is_super_admin = true where id = tests.id('super');

-- ---------------------------------------------------------------------
-- Plano e empresas (pré-registo pelo Super Admin do Sistema)
-- ---------------------------------------------------------------------
select tests.login('super');
set role authenticated;
with p as (insert into public.plans (name, slug, price, features, limits) values
  ('Profissional', 'profissional', 4990,
   '[{"featureKey":"MENU_DIGITAL","enabled":true},{"featureKey":"NFC","enabled":true},{"featureKey":"MENU_CUSTOMIZATION","enabled":true}]',
   '[]') returning id) select tests.put('plan', id) from p;
update public.platform_config set default_plan_id = tests.id('plan');
select tests.put('invA', public.admin_preregister_company(jsonb_build_object(
  'companyName', 'Sabores de Moçambique, Lda', 'commercialName', 'Sabores de Moçambique',
  'ownerName', 'Dono A', 'ownerEmail', 'dono@empresa-a.test', 'planId', tests.id('plan'))));
select tests.put('invB', public.admin_preregister_company(jsonb_build_object(
  'companyName', 'Casa B, Lda', 'commercialName', 'Casa B',
  'ownerName', 'Dono B', 'ownerEmail', 'dono@empresa-b.test', 'planId', tests.id('plan'))));
reset role;
select tests.put('companyA', company_id) from public.establishment_invitations where id = tests.id('invA');
select tests.put('companyB', company_id) from public.establishment_invitations where id = tests.id('invB');
select tests.ok('Super Admin do Sistema cria empresas com plano', (select count(*) = 2 from public.subscriptions where plan_id = tests.id('plan')));
select tests.ok('criação da empresa fica no histórico global',
  (select count(*) = 2 from public.platform_admin_logs where action = 'company.created'));

-- Os donos entram (convite aceite) e as empresas completam o perfil.
select tests.login('ownerA'); set role authenticated;
select public.complete_first_access();
select public.complete_company_onboarding(tests.id('companyA'));
reset role;
select tests.login('ownerB'); set role authenticated;
select public.complete_first_access();
select public.complete_company_onboarding(tests.id('companyB'));
reset role;

-- ---------------------------------------------------------------------
-- Dados completos de uma empresa: estabelecimento, equipa, mesas, menu,
-- NFC, sessão ativa, pedido, pagamento, atendimento, ficheiros.
-- ---------------------------------------------------------------------
create function tests.seed(x text) returns void language plpgsql as $$
declare
  v_company uuid := tests.id('company' || x);
  v_rest uuid; v_t1 uuid; v_t2 uuid; v_cat uuid; v_prod uuid; v_tag uuid;
  v_s jsonb; v_sess uuid; v_tok uuid; v_order jsonb;
  v_domain text := 'empresa-' || lower(x) || '.test';
begin
  perform tests.login('owner' || x);
  insert into public.restaurants (company_id, name, slug) values (v_company, 'Restaurante ' || x, '') returning id into v_rest;
  insert into public.staff_members (company_id, name, email, role, restaurant_ids) values
    (v_company, 'Garçom ' || x, 'garcom@' || v_domain, 'waiter', array[v_rest]),
    (v_company, 'Pendente ' || x, 'pendente@' || v_domain, 'waiter', array[v_rest]);
  insert into public.dining_tables (restaurant_id, number) values (v_rest, '01') returning id into v_t1;
  insert into public.dining_tables (restaurant_id, number) values (v_rest, '02') returning id into v_t2;
  insert into public.categories (restaurant_id, name) values (v_rest, 'Pratos') returning id into v_cat;
  insert into public.products (restaurant_id, category_id, name, price) values (v_rest, v_cat, 'Frango', 500) returning id into v_prod;
  insert into public.product_variants (product_id, name, price_delta) values (v_prod, 'Grande', 100);
  insert into public.product_addons (product_id, name, price) values (v_prod, 'Batata', 50);
  insert into public.menu_customizations (restaurant_id, theme) values (v_rest, '{"layout":"grid"}');

  perform tests.login('super');
  select id into v_tag from public.nfc_register_tags(v_rest, null, 1);
  perform public.nfc_assign_tag(v_tag, v_t1);

  -- Cliente na mesa (anónimo): sessão ativa, pedido, atendimento e conta.
  perform tests.login(null);
  v_s := public.start_table_session(v_t1, 'Ana', 2);
  v_sess := (v_s -> 'session' ->> 'id')::uuid;
  v_tok := (v_s -> 'participant' ->> 'token')::uuid;
  v_order := public.place_order(v_sess, v_tok, jsonb_build_array(jsonb_build_object('productId', v_prod, 'quantity', 2)));
  perform public.create_service_request(v_t1, 'water', v_sess, v_tok);
  perform public.request_bill(v_sess, v_tok);

  insert into storage.objects (bucket_id, name) values ('media', v_company || '/' || v_rest || '/products/frango.webp');

  perform tests.put('rest' || x, v_rest);
  perform tests.put('table1' || x, v_t1);
  perform tests.put('table2' || x, v_t2);
  perform tests.put('prod' || x, v_prod);
  perform tests.put('tag' || x, v_tag);
  perform tests.put('session' || x, v_sess);
  perform tests.put('token' || x, v_tok);
  perform tests.put('order' || x, (v_order ->> 'id')::uuid);
  perform tests.login(null);
end;
$$;

select tests.seed('A');
select tests.seed('B');

-- Equipa liga as contas (email confirmado).
select tests.login('waiterA'); set role authenticated; select public.claim_staff_invitations(); reset role;
select tests.login('waiterB'); set role authenticated; select public.claim_staff_invitations(); reset role;
-- "Partilhado": membro da B; depois convidado também pela A.
select tests.login('ownerB'); set role authenticated;
insert into public.staff_members (company_id, name, email, role, restaurant_ids)
values (tests.id('companyB'), 'Partilhado', 'partilhado@empresas.test', 'manager', array[tests.id('restB')]);
reset role;
select tests.login('shared'); set role authenticated; select public.claim_staff_invitations(); reset role;
select tests.login('ownerA'); set role authenticated;
insert into public.staff_members (company_id, name, email, role, restaurant_ids)
values (tests.id('companyA'), 'Partilhado', 'partilhado@empresas.test', 'waiter', array[tests.id('restA')]);
reset role;

select tests.ok('dados de teste criados nas duas empresas',
  (select count(*) = 2 from public.orders) and (select count(*) = 2 from public.nfc_tags)
  and (select count(*) = 2 from public.table_sessions where status = 'active'));

-- =====================================================================
-- 1. Super Admin do Sistema gere qualquer empresa
-- =====================================================================
select tests.login('super');
set role authenticated;
select tests.ok('Super Admin vê todas as empresas', (select count(*) = 2 from public.companies));
select tests.ok('Super Admin vê pedidos e pagamentos de todas as empresas',
  (select count(*) = 2 from public.orders) and (select count(*) >= 2 from public.payments));
update public.companies set phone = '+258 84 000 0001' where id = tests.id('companyB');
insert into public.dining_tables (restaurant_id, number) values (tests.id('restB'), '99');
insert into public.categories (restaurant_id, name) values (tests.id('restB'), 'Bebidas (Super Admin)');
update public.staff_members set phone = '+258 84 000 0002' where company_id = tests.id('companyB') and role = 'waiter';
reset role;
select tests.ok('Super Admin altera dados, mesas, menu e funcionários de outra empresa',
  (select phone = '+258 84 000 0001' from public.companies where id = tests.id('companyB'))
  and exists (select 1 from public.dining_tables where restaurant_id = tests.id('restB') and number = '99')
  and exists (select 1 from public.categories where name = 'Bebidas (Super Admin)')
  and exists (select 1 from public.staff_members where phone = '+258 84 000 0002'));
-- Mesa e categoria extra da B não fazem parte do resto dos testes.
delete from public.dining_tables where restaurant_id = tests.id('restB') and number = '99';
delete from public.categories where name = 'Bebidas (Super Admin)';

-- =====================================================================
-- 2. Dono da Empresa: só a própria empresa
-- =====================================================================
select tests.login('ownerA');
set role authenticated;
select tests.ok('dono vê só a sua empresa', (select count(*) = 1 from public.companies) and (select id = tests.id('companyA') from public.companies));
select tests.ok('dono NÃO vê estabelecimentos, mesas, tags, produtos, pedidos nem pagamentos de outra empresa',
  not exists (select 1 from public.restaurants where company_id = tests.id('companyB'))
  and not exists (select 1 from public.dining_tables where company_id = tests.id('companyB'))
  and not exists (select 1 from public.nfc_tags where company_id = tests.id('companyB'))
  and not exists (select 1 from public.products where company_id = tests.id('companyB'))
  and not exists (select 1 from public.orders where company_id = tests.id('companyB'))
  and not exists (select 1 from public.payments where company_id = tests.id('companyB')));
update public.companies set name = 'Invadida' where id = tests.id('companyB');
do $$ begin
  insert into public.dining_tables (restaurant_id, number) values (tests.id('restB'), '50');
  perform tests.ok('dono NÃO cria mesas noutra empresa', false);
exception when others then perform tests.ok('dono NÃO cria mesas noutra empresa', true, sqlerrm); end $$;
do $$ begin
  perform public.admin_delete_company(tests.id('companyB'), 'Casa B');
  perform tests.ok('dono NÃO elimina outra empresa', false);
exception when others then perform tests.ok('dono NÃO elimina outra empresa', sqlerrm like 'Apenas o Super Admin%', sqlerrm); end $$;
do $$ begin
  perform public.admin_delete_company(tests.id('companyA'), 'Sabores de Moçambique');
  perform tests.ok('dono NÃO elimina a própria empresa', false);
exception when others then perform tests.ok('dono NÃO elimina a própria empresa', sqlerrm like 'Apenas o Super Admin%', sqlerrm); end $$;
do $$ begin
  perform public.admin_company_deletion_preview(tests.id('companyA'));
  perform tests.ok('dono NÃO consulta o resumo de eliminação', false);
exception when others then perform tests.ok('dono NÃO consulta o resumo de eliminação', true, sqlerrm); end $$;
do $$ begin
  delete from public.companies where id = tests.id('companyB');
  perform tests.ok('DELETE direto em companies recusado', false);
exception when others then perform tests.ok('DELETE direto em companies recusado', true, sqlerrm); end $$;
do $$ begin
  update public.plans set price = 1 where id = tests.id('plan');
  perform tests.ok('dono NÃO altera planos globalmente', not exists (select 1 from public.plans where price = 1));
exception when others then perform tests.ok('dono NÃO altera planos globalmente', true, sqlerrm); end $$;
do $$ begin
  update public.profiles set is_super_admin = true where id = tests.id('waiterA');
  perform tests.ok('dono NÃO cria Super Admins', false);
exception when others then perform tests.ok('dono NÃO cria Super Admins', true, sqlerrm); end $$;
do $$ begin
  update public.companies set is_active = false where id = tests.id('companyA');
  perform tests.ok('dono NÃO suspende/ativa a empresa', false);
exception when others then perform tests.ok('dono NÃO suspende/ativa a empresa', true, sqlerrm); end $$;
select tests.ok('dono NÃO lê o histórico global', (select count(*) = 0 from public.platform_admin_logs));
reset role;
select tests.ok('dono NÃO altera dados de outra empresa (0 linhas)', (select name = 'Casa B' from public.companies where id = tests.id('companyB')));

select tests.login('ownerB');
set role authenticated;
select tests.ok('empresa B NÃO vê a empresa A', not exists (select 1 from public.companies where id = tests.id('companyA'))
  and not exists (select 1 from public.orders where company_id = tests.id('companyA')));
reset role;

select tests.ok('empresa ativa: menu público disponível',
  public.get_public_table((select slug from public.restaurants where id = tests.id('restA')), 'mesa-02') is not null);

-- =====================================================================
-- 3. Suspender empresa: bloqueia o acesso, mantém os dados, reversível
-- =====================================================================
select tests.login('super');
set role authenticated;
update public.companies set is_active = false where id = tests.id('companyA');
reset role;
select tests.ok('suspensão fica no histórico global',
  exists (select 1 from public.platform_admin_logs where action = 'company.suspended' and target_id = tests.id('companyA')));

select tests.login('ownerA');
set role authenticated;
select tests.ok('empresa suspensa: dono deixa de ver estabelecimentos, mesas, pedidos e equipa',
  (select count(*) = 0 from public.restaurants) and (select count(*) = 0 from public.dining_tables)
  and (select count(*) = 0 from public.orders) and (select count(*) = 1 from public.staff_members));
select tests.ok('empresa suspensa: a conta lê o estado da empresa (para a aplicação mostrar o aviso)',
  (select is_active = false from public.companies where id = tests.id('companyA')));
do $$ begin
  insert into public.dining_tables (restaurant_id, number) values (tests.id('restA'), '03');
  perform tests.ok('empresa suspensa: dono NÃO cria mesas', false);
exception when others then perform tests.ok('empresa suspensa: dono NÃO cria mesas', true, sqlerrm); end $$;
update public.products set price = 1 where company_id = tests.id('companyA');
reset role;
select tests.ok('empresa suspensa: dono NÃO altera produtos (0 linhas)', (select price = 500 from public.products where id = tests.id('prodA')));

select tests.login('waiterA');
set role authenticated;
select tests.ok('empresa suspensa: funcionário também fica bloqueado', (select count(*) = 0 from public.orders));
reset role;

insert into tests.snapshots select 'slugA', to_jsonb(slug) from public.restaurants where id = tests.id('restA');
select tests.ok('slug do estabelecimento A conhecido (o teste seguinte não é vazio)',
  (select value #>> '{}' from tests.snapshots where key = 'slugA') <> '');
select tests.login(null);
set role anon;
select tests.ok('empresa suspensa: menu público indisponível',
  public.get_public_table((select value #>> '{}' from tests.snapshots where key = 'slugA'), 'mesa-02') is null
  and public.get_public_menu(tests.id('restA')) is null);
do $$ begin
  perform public.place_order(tests.id('sessionA'), tests.id('tokenA'), jsonb_build_array(jsonb_build_object('productId', tests.id('prodA'), 'quantity', 1)));
  perform tests.ok('empresa suspensa: não aceita pedidos', false);
exception when others then perform tests.ok('empresa suspensa: não aceita pedidos', true, sqlerrm); end $$;
do $$ begin
  perform public.start_table_session(tests.id('table2A'), 'Rui');
  perform tests.ok('empresa suspensa: não abre sessões', false);
exception when others then perform tests.ok('empresa suspensa: não abre sessões', true, sqlerrm); end $$;
do $$ begin
  perform public.create_service_request(tests.id('table2A'), 'waiter_call');
  perform tests.ok('empresa suspensa: não aceita chamadas', false);
exception when others then perform tests.ok('empresa suspensa: não aceita chamadas', true, sqlerrm); end $$;
select tests.ok('suspensão de A NÃO afeta o menu público de B', public.get_public_menu(tests.id('restB')) is not null);
reset role;

select tests.login('ownerB');
set role authenticated;
select tests.ok('suspensão de A NÃO afeta o acesso de B', (select count(*) = 1 from public.restaurants) and (select count(*) = 1 from public.orders));
reset role;

select tests.ok('empresa suspensa mantém os dados',
  (select count(*) = 1 from public.restaurants where company_id = tests.id('companyA'))
  and (select count(*) = 1 from public.orders where company_id = tests.id('companyA')));

select tests.login('super');
set role authenticated;
update public.companies set is_active = true where id = tests.id('companyA');
reset role;
select tests.login('ownerA');
set role authenticated;
select tests.ok('reativar devolve o acesso', (select count(*) = 1 from public.restaurants) and (select count(*) = 2 from public.dining_tables));
reset role;
select tests.ok('reativação fica no histórico global',
  exists (select 1 from public.platform_admin_logs where action = 'company.activated' and target_id = tests.id('companyA')));

-- =====================================================================
-- 4. Eliminar empresa
-- =====================================================================
-- Fotografia da empresa B (para provar que fica intacta).
insert into tests.snapshots values ('B', (
  select jsonb_build_object(
    'summary', private.company_data_summary(tests.id('companyB')),
    'company', (select to_jsonb(c) - 'updated_at' from public.companies c where c.id = tests.id('companyB')),
    'subscription', (select to_jsonb(s) - 'updated_at' from public.subscriptions s where s.company_id = tests.id('companyB')),
    'staff', (select jsonb_agg(to_jsonb(m) - 'updated_at' order by m.id) from public.staff_members m where m.company_id = tests.id('companyB')),
    'variants', (select count(*) from public.product_variants v where v.restaurant_id = tests.id('restB')),
    'addons', (select count(*) from public.product_addons a where a.restaurant_id = tests.id('restB')),
    'items', (select count(*) from public.order_items i where i.restaurant_id = tests.id('restB')),
    'participants', (select count(*) from public.session_participants p where p.session_id = tests.id('sessionB')),
    'tagEvents', (select count(*) from public.nfc_tag_events e where e.restaurant_id = tests.id('restB')),
    'notifications', (select count(*) from public.notifications n where n.company_id = tests.id('companyB')),
    'audit', (select count(*) from public.audit_logs a where a.company_id = tests.id('companyB')),
    'profiles', (select count(*) from public.profiles where id in (tests.id('ownerB'), tests.id('waiterB'), tests.id('shared'))),
    'storage', (select count(*) from storage.objects where name like tests.id('companyB') || '/%')
  )));

select tests.login('super');
set role authenticated;
select tests.ok('resumo antes de eliminar: estabelecimentos, mesas, utilizadores, produtos, pedidos',
  (select (p -> 'counts' ->> 'restaurants')::int = 1 and (p -> 'counts' ->> 'tables')::int = 2
      and (p -> 'counts' ->> 'products')::int = 1 and (p -> 'counts' ->> 'orders')::int = 1
      and (p -> 'counts' ->> 'nfcTags')::int = 1 and (p -> 'counts' ->> 'staff')::int = 4
      and (p ->> 'authAccounts')::int = 3 and p ->> 'name' = 'Sabores de Moçambique'
   from public.admin_company_deletion_preview(tests.id('companyA')) p),
  (select public.admin_company_deletion_preview(tests.id('companyA'))::text));
do $$
declare v_hint text;
begin
  perform public.admin_delete_company(tests.id('companyA'), 'Sabores');
  perform tests.ok('nome de confirmação errado recusa a eliminação', false);
exception when others then
  get stacked diagnostics v_hint = pg_exception_hint;
  perform tests.ok('nome de confirmação errado recusa a eliminação', v_hint = 'confirmation_mismatch', sqlerrm);
end $$;
reset role;
select tests.ok('após confirmação errada nada foi eliminado', exists (select 1 from public.companies where id = tests.id('companyA')));

-- Mesa 01 da A tem uma sessão ativa e uma tag NFC associada: a eliminação tem de funcionar na mesma.
select tests.login('super');
set role authenticated;
create temp table deletion as select public.admin_delete_company(tests.id('companyA'), '  sabores de moçambique ') as r;
reset role;
select tests.ok('eliminação devolve o resumo e as contas a remover',
  (select (r -> 'deleted' ->> 'orders')::int = 1 and jsonb_array_length(r -> 'authUsers') = 3 from deletion));

select tests.ok('empresa eliminada', not exists (select 1 from public.companies where id = tests.id('companyA')));
select tests.ok('estabelecimentos eliminados', not exists (select 1 from public.restaurants where company_id = tests.id('companyA') or id = tests.id('restA')));
select tests.ok('mesas eliminadas', not exists (select 1 from public.dining_tables where restaurant_id = tests.id('restA')));
select tests.ok('sessões e participantes eliminados',
  not exists (select 1 from public.table_sessions where restaurant_id = tests.id('restA'))
  and not exists (select 1 from public.session_participants where session_id = tests.id('sessionA')));
select tests.ok('tags NFC e histórico das tags eliminados',
  not exists (select 1 from public.nfc_tags where id = tests.id('tagA'))
  and not exists (select 1 from public.nfc_tag_events where tag_id = tests.id('tagA')));
select tests.ok('categorias, produtos, variantes, adicionais e personalização eliminados',
  not exists (select 1 from public.categories where restaurant_id = tests.id('restA'))
  and not exists (select 1 from public.products where restaurant_id = tests.id('restA'))
  and not exists (select 1 from public.product_variants where restaurant_id = tests.id('restA'))
  and not exists (select 1 from public.product_addons where restaurant_id = tests.id('restA'))
  and not exists (select 1 from public.menu_customizations where restaurant_id = tests.id('restA')));
select tests.ok('pedidos, itens e histórico dos pedidos eliminados',
  not exists (select 1 from public.orders where restaurant_id = tests.id('restA'))
  and not exists (select 1 from public.order_items where restaurant_id = tests.id('restA'))
  and not exists (select 1 from public.order_status_history where restaurant_id = tests.id('restA')));
select tests.ok('pagamentos eliminados', not exists (select 1 from public.payments where restaurant_id = tests.id('restA')));
select tests.ok('atendimento e notificações eliminados',
  not exists (select 1 from public.service_requests where restaurant_id = tests.id('restA'))
  and not exists (select 1 from public.notifications where restaurant_id = tests.id('restA')));
select tests.ok('funcionários eliminados', not exists (select 1 from public.staff_members where company_id = tests.id('companyA')));
select tests.ok('subscrição e histórico da subscrição eliminados',
  not exists (select 1 from public.subscriptions where company_id = tests.id('companyA'))
  and not exists (select 1 from public.subscription_events where company_id = tests.id('companyA')));
select tests.ok('pré-registo/onboarding e contadores eliminados',
  not exists (select 1 from public.establishment_invitations where id = tests.id('invA'))
  and not exists (select 1 from public.restaurant_counters where restaurant_id = tests.id('restA')));
select tests.ok('histórico interno da empresa eliminado (só ficam ações do Super Admin)',
  not exists (select 1 from public.audit_logs a where a.user_id in (tests.id('ownerA'), tests.id('waiterA'))));

-- Contas Auth: só as que eram exclusivas da empresa A.
select tests.ok('contas Auth da empresa A marcadas para remoção (dono, funcionário, convite pendente)',
  (select array_agg(user_id order by user_id) from public.pending_auth_deletions)
  = (select array_agg(x order by x) from unnest(array[tests.id('ownerA'), tests.id('waiterA'), tests.id('pendingA')]) x));
select tests.ok('conta partilhada com a empresa B NÃO é removida',
  not exists (select 1 from public.pending_auth_deletions where user_id = tests.id('shared')));
select tests.ok('Super Admin nunca é removido', not exists (select 1 from public.pending_auth_deletions where user_id = tests.id('super')));
-- O que a Edge Function faz com a chave de serviço:
delete from auth.users where id in (select user_id from public.pending_auth_deletions);
delete from public.pending_auth_deletions;
select tests.ok('sem utilizadores órfãos: contas e perfis da A removidos',
  not exists (select 1 from auth.users where id in (tests.id('ownerA'), tests.id('waiterA'), tests.id('pendingA')))
  and not exists (select 1 from public.profiles where id in (tests.id('ownerA'), tests.id('waiterA'), tests.id('pendingA'))));

-- Histórico global
select tests.ok('eliminação registada no histórico global (autor, empresa, data, resumo)',
  exists (select 1 from public.platform_admin_logs
          where action = 'company.deleted' and target_id = tests.id('companyA') and target_name = 'Sabores de Moçambique'
            and actor_id = tests.id('super') and actor_name = 'Super Admin' and created_at is not null
            and (details -> 'deleted' ->> 'restaurants')::int = 1));
select tests.ok('histórico global anterior da empresa mantido',
  (select count(*) = 3 from public.platform_admin_logs where target_id = tests.id('companyA')
     and action in ('company.created', 'company.suspended', 'company.activated')));
do $$ begin
  delete from public.platform_admin_logs where target_id = tests.id('companyA');
  perform tests.ok('histórico global NÃO pode ser apagado', false);
exception when others then perform tests.ok('histórico global NÃO pode ser apagado', true, sqlerrm); end $$;
select tests.login('super');
set role authenticated;
select tests.ok('Super Admin lê o histórico global', (select count(*) >= 4 from public.platform_admin_logs));
reset role;

-- Empresa B intacta
select tests.ok('empresa B completamente intacta', (
  select s.value = jsonb_build_object(
    'summary', private.company_data_summary(tests.id('companyB')),
    'company', (select to_jsonb(c) - 'updated_at' from public.companies c where c.id = tests.id('companyB')),
    'subscription', (select to_jsonb(s2) - 'updated_at' from public.subscriptions s2 where s2.company_id = tests.id('companyB')),
    'staff', (select jsonb_agg(to_jsonb(m) - 'updated_at' order by m.id) from public.staff_members m where m.company_id = tests.id('companyB')),
    'variants', (select count(*) from public.product_variants v where v.restaurant_id = tests.id('restB')),
    'addons', (select count(*) from public.product_addons a where a.restaurant_id = tests.id('restB')),
    'items', (select count(*) from public.order_items i where i.restaurant_id = tests.id('restB')),
    'participants', (select count(*) from public.session_participants p where p.session_id = tests.id('sessionB')),
    'tagEvents', (select count(*) from public.nfc_tag_events e where e.restaurant_id = tests.id('restB')),
    'notifications', (select count(*) from public.notifications n where n.company_id = tests.id('companyB')),
    'audit', (select count(*) from public.audit_logs a where a.company_id = tests.id('companyB')),
    'profiles', (select count(*) from public.profiles where id in (tests.id('ownerB'), tests.id('waiterB'), tests.id('shared'))),
    'storage', (select count(*) from storage.objects where name like tests.id('companyB') || '/%'))
  from tests.snapshots s where s.key = 'B'));
select tests.login('ownerB');
set role authenticated;
select tests.ok('empresa B continua a funcionar', (select count(*) = 1 from public.restaurants) and (select count(*) = 1 from public.orders));
reset role;
select tests.login('shared');
set role authenticated;
select tests.ok('conta partilhada continua ligada à empresa B', (select count(*) = 1 from public.restaurants where id = tests.id('restB')));
reset role;
select tests.login(null);
set role anon;
select tests.ok('menu público de B continua disponível', public.get_public_menu(tests.id('restB')) is not null);
reset role;

-- =====================================================================
-- 5. Integridade: categoria com produtos continua protegida
-- =====================================================================
select tests.login('ownerB');
set role authenticated;
do $$ begin
  delete from public.categories where restaurant_id = tests.id('restB');
  perform tests.ok('categoria com produtos NÃO é eliminada diretamente', false);
exception when others then perform tests.ok('categoria com produtos NÃO é eliminada diretamente', true, sqlerrm); end $$;
reset role;

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
