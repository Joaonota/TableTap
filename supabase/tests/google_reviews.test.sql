-- =====================================================================
-- Testes: pedidos de avaliação no Google após a sessão da mesa
-- (migração 1000).
--
-- Executar com:  npm run test:db -- google_reviews
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
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------
-- Contas, plano, empresas
-- ---------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  (tests.put('super',   gen_random_uuid()), 'super@tapmenu.test',    now(), '{"full_name":"Super Admin"}'),
  (tests.put('ownerA',  gen_random_uuid()), 'dono@empresa-a.test',   now(), '{"full_name":"Dono A"}'),
  (tests.put('waiterA', gen_random_uuid()), 'garcom@empresa-a.test', now(), '{"full_name":"Garçom A"}'),
  (tests.put('ownerB',  gen_random_uuid()), 'dono@empresa-b.test',   now(), '{"full_name":"Dono B"}');
update public.profiles set is_super_admin = true where id = tests.id('super');

select tests.login('super');
set role authenticated;
with p as (insert into public.plans (name, slug, price, features, limits) values
  ('Profissional', 'profissional', 4990, '[{"featureKey":"MENU_DIGITAL","enabled":true}]', '[]') returning id)
select tests.put('plan', id) from p;
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

select tests.login('ownerA'); set role authenticated;
select public.complete_first_access();
select public.complete_company_onboarding(tests.id('companyA'));
reset role;
select tests.login('ownerB'); set role authenticated;
select public.complete_first_access();
select public.complete_company_onboarding(tests.id('companyB'));
reset role;

-- Três estabelecimentos da empresa A; Beira sem link.
select tests.login('ownerA'); set role authenticated;
with r as (insert into public.restaurants (company_id, name, slug) values (tests.id('companyA'), 'Sabores Maputo', '') returning id)
select tests.put('maputo', id) from r;
with r as (insert into public.restaurants (company_id, name, slug) values (tests.id('companyA'), 'Sabores Matola', '') returning id)
select tests.put('matola', id) from r;
with r as (insert into public.restaurants (company_id, name, slug) values (tests.id('companyA'), 'Sabores Beira', '') returning id)
select tests.put('beira', id) from r;
with t as (insert into public.dining_tables (restaurant_id, number) values (tests.id('maputo'), '01') returning id) select tests.put('tMaputo', id) from t;
with t as (insert into public.dining_tables (restaurant_id, number) values (tests.id('matola'), '01') returning id) select tests.put('tMatola', id) from t;
with t as (insert into public.dining_tables (restaurant_id, number) values (tests.id('beira'), '01') returning id) select tests.put('tBeira', id) from t;
reset role;

-- Garçom da empresa A (nível 10: não vê o painel de avaliações).
insert into public.staff_members (company_id, user_id, name, email, role, restaurant_ids)
values (tests.id('companyA'), tests.id('waiterA'), 'Garçom A', 'garcom@empresa-a.test', 'waiter',
        array[tests.id('maputo'), tests.id('matola'), tests.id('beira')]);

-- ---------------------------------------------------------------------
-- 1. Link de avaliação por estabelecimento (validado na base de dados)
-- ---------------------------------------------------------------------
select tests.login('ownerA'); set role authenticated;
select tests.ok('recusa link que não é do Google',
  tests.error_hint(format('update public.restaurants set google_review_url = %L where id = %L',
    'https://example.com/review', tests.id('maputo'))) = '23514');
select tests.ok('recusa link sem https',
  tests.error_hint(format('update public.restaurants set google_review_url = %L where id = %L',
    'http://g.page/r/abc/review', tests.id('maputo'))) = '23514');
select tests.ok('recusa domínio que imita o Google',
  tests.error_hint(format('update public.restaurants set google_review_url = %L where id = %L',
    'https://g.page.evil.com/r/abc', tests.id('maputo'))) = '23514');
-- Migração 1200: link do botão "Partilhar" do Google Maps.
select tests.ok('aceita link de partilha share.google',
  tests.error_hint(format('update public.restaurants set google_review_url = %L where id = %L',
    'https://share.google/AbCdEf12345', tests.id('maputo'))) = '');
select tests.ok('recusa domínio que imita share.google',
  tests.error_hint(format('update public.restaurants set google_review_url = %L where id = %L',
    'https://share.google.evil.com/abc', tests.id('maputo'))) = '23514');
update public.restaurants set google_review_url = 'https://g.page/r/MAPUTO123/review' where id = tests.id('maputo');
update public.restaurants set google_review_url = 'https://search.google.com/local/writereview?placeid=ChIJMatola000000' where id = tests.id('matola');
reset role;
select tests.ok('cada estabelecimento guarda o seu próprio link',
  (select google_review_url from public.restaurants where id = tests.id('maputo')) = 'https://g.page/r/MAPUTO123/review'
  and (select google_review_url from public.restaurants where id = tests.id('matola')) like '%placeid=ChIJMatola%'
  and (select google_review_url from public.restaurants where id = tests.id('beira')) is null);

select set_config('tests.slug_maputo', slug, false) from public.restaurants where id = tests.id('maputo');
select tests.login(null); set role anon;
select tests.ok('menu público expõe o link do estabelecimento',
  public.get_public_table(current_setting('tests.slug_maputo'), '01') -> 'restaurant' ->> 'googleReviewUrl'
  = 'https://g.page/r/MAPUTO123/review');
reset role;

-- ---------------------------------------------------------------------
-- 2. Antes de a sessão terminar: nenhum pedido de avaliação
-- ---------------------------------------------------------------------
select tests.login(null); set role anon;
create temp table s_maputo as select public.start_table_session(tests.id('tMaputo'), 'Ana', 2) as r;
create temp table j_maputo as select public.join_table_session((select (r -> 'session' ->> 'id')::uuid from s_maputo), 'Bruno') as r;
reset role;
select tests.put('sessMaputo', (r -> 'session' ->> 'id')::uuid) from s_maputo;
select tests.put('tokAna', (r -> 'participant' ->> 'token')::uuid) from s_maputo;
select tests.put('tokBruno', (r -> 'participant' ->> 'token')::uuid) from j_maputo;

select tests.login(null); set role anon;
create temp table c_active as select public.get_session_closure(tests.id('sessMaputo'), tests.id('tokAna'), 'mobile') as r;
reset role;
select tests.ok('sessão ativa: sem pedido de avaliação',
  (select r ->> 'status' = 'active' and r -> 'reviewRequest' = 'null'::jsonb from c_active)
  and not exists (select 1 from public.review_requests));

select tests.login(null); set role anon;
select tests.ok('token de outra sessão é recusado',
  tests.error_hint(format('select public.get_session_closure(%L, %L)', tests.id('sessMaputo'), gen_random_uuid())) = 'not_participant');
select tests.ok('sem token é recusado',
  tests.error_hint(format('select public.get_session_closure(%L, null)', tests.id('sessMaputo'))) = 'not_participant');
reset role;

-- ---------------------------------------------------------------------
-- 3. Sessão encerrada pela equipa → pedido apresentado (um por telemóvel)
-- ---------------------------------------------------------------------
select tests.login('ownerA'); set role authenticated;
select public.close_table_session(tests.id('sessMaputo'));
reset role;

select tests.login(null); set role anon;
create temp table c_ana as select public.get_session_closure(tests.id('sessMaputo'), tests.id('tokAna'), 'mobile') as r;
create temp table c_ana2 as select public.get_session_closure(tests.id('sessMaputo'), tests.id('tokAna'), 'desktop') as r;
create temp table c_bruno as select public.get_session_closure(tests.id('sessMaputo'), tests.id('tokBruno'), 'invalido') as r;
reset role;
select tests.put('reqAna', (r -> 'reviewRequest' ->> 'id')::uuid) from c_ana;
select tests.put('reqBruno', (r -> 'reviewRequest' ->> 'id')::uuid) from c_bruno;

select tests.ok('sessão encerrada: devolve o link do estabelecimento correto',
  (select r ->> 'status' = 'closed'
      and r -> 'reviewRequest' ->> 'url' = 'https://g.page/r/MAPUTO123/review'
      and r -> 'reviewRequest' ->> 'status' = 'presented'
      and r -> 'restaurant' ->> 'name' = 'Sabores Maputo' from c_ana));
select tests.ok('pedido idempotente por participante (recarregar a página não duplica)',
  (select count(*) from public.review_requests where participant_id =
     (select id from public.session_participants where token = tests.id('tokAna'))) = 1
  and (select r -> 'reviewRequest' ->> 'id' from c_ana2) = tests.id('reqAna')::text);
select tests.ok('cada telemóvel da mesa tem o seu pedido', (select count(*) from public.review_requests) = 2);
select tests.ok('regista estabelecimento, sessão, data, link e dispositivo',
  exists (select 1 from public.review_requests q
          where q.id = tests.id('reqAna') and q.restaurant_id = tests.id('maputo') and q.company_id = tests.id('companyA')
            and q.table_session_id = tests.id('sessMaputo') and q.presented_at is not null
            and q.review_url = 'https://g.page/r/MAPUTO123/review' and q.device_type = 'mobile' and q.provider = 'google'));
select tests.ok('dispositivo desconhecido não é gravado',
  (select device_type is null from public.review_requests where id = tests.id('reqBruno')));

-- ---------------------------------------------------------------------
-- 4. Clique e encaminhamento (o estado só avança)
-- ---------------------------------------------------------------------
select tests.login(null); set role anon;
select tests.ok('clique → Google aberto',
  public.track_review_request(tests.id('reqAna'), tests.id('tokAna'), 'google_opened') = 'google_opened');
select tests.ok('saída para o Google → encaminhado',
  public.track_review_request(tests.id('reqAna'), tests.id('tokAna'), 'forwarded') = 'forwarded');
select tests.ok('o estado não recua',
  public.track_review_request(tests.id('reqAna'), tests.id('tokAna'), 'google_opened') = 'forwarded');
select tests.ok('não regista com o token de outro participante',
  tests.error_hint(format('select public.track_review_request(%L, %L, %L)', tests.id('reqAna'), tests.id('tokBruno'), 'google_opened')) = 'not_found');
select tests.ok('evento desconhecido é recusado (ex.: "publicado")',
  tests.error_hint(format('select public.track_review_request(%L, %L, %L)', tests.id('reqAna'), tests.id('tokAna'), 'published')) = 'invalid_event');
-- Migração 1100: encaminhamento automático no fim da sessão.
select tests.ok('encaminhamento automático → encaminhado',
  public.track_review_request(tests.id('reqBruno'), tests.id('tokBruno'), 'auto_redirected') = 'forwarded');
select tests.ok('repetir o encaminhamento automático não altera nada',
  public.track_review_request(tests.id('reqBruno'), tests.id('tokBruno'), 'auto_redirected') = 'forwarded');
reset role;
select tests.ok('encaminhamento automático não conta como clique',
  (select redirect_mode = 'automatic' and forwarded_at is not null and opened_at is null
   from public.review_requests where id = tests.id('reqBruno')));
select tests.ok('toque no botão fica marcado como "button"',
  (select redirect_mode = 'button' from public.review_requests where id = tests.id('reqAna')));
select tests.ok('datas de clique e encaminhamento registadas',
  (select opened_at is not null and forwarded_at is not null and forwarded_at >= opened_at
   from public.review_requests where id = tests.id('reqAna')));
select tests.ok('não há nenhum estado de "avaliação publicada"',
  not exists (select 1 from public.review_requests where status not in ('presented', 'google_opened', 'forwarded')));

-- ---------------------------------------------------------------------
-- 5. Casos sem pedido: sessão cancelada, estabelecimento sem link
-- ---------------------------------------------------------------------
select tests.login(null); set role anon;
create temp table s_matola as select public.start_table_session(tests.id('tMatola'), 'Carla') as r;
create temp table s_beira as select public.start_table_session(tests.id('tBeira'), 'Dino') as r;
reset role;
select tests.put('sessMatola', (r -> 'session' ->> 'id')::uuid), tests.put('tokCarla', (r -> 'participant' ->> 'token')::uuid) from s_matola;
select tests.put('sessBeira', (r -> 'session' ->> 'id')::uuid), tests.put('tokDino', (r -> 'participant' ->> 'token')::uuid) from s_beira;
select tests.login('ownerA'); set role authenticated;
select public.cancel_table_session(tests.id('sessMatola'), 'Engano');
select public.close_table_session(tests.id('sessBeira'));
reset role;
select tests.login(null); set role anon;
create temp table c_matola as select public.get_session_closure(tests.id('sessMatola'), tests.id('tokCarla')) as r;
create temp table c_beira as select public.get_session_closure(tests.id('sessBeira'), tests.id('tokDino')) as r;
reset role;
select tests.ok('sessão cancelada: sem pedido de avaliação',
  (select r ->> 'status' = 'cancelled' and r -> 'reviewRequest' = 'null'::jsonb from c_matola)
  and not exists (select 1 from public.review_requests where restaurant_id = tests.id('matola')));
select tests.ok('estabelecimento sem link: agradece sem pedir avaliação',
  (select r ->> 'status' = 'closed' and r -> 'reviewRequest' = 'null'::jsonb from c_beira)
  and not exists (select 1 from public.review_requests where restaurant_id = tests.id('beira')));

-- Cada estabelecimento encaminha para o SEU link (mesma empresa, links diferentes).
select tests.login(null); set role anon;
create temp table s_matola2 as select public.start_table_session(tests.id('tMatola'), 'Eva') as r;
reset role;
select tests.put('sessMatola2', (r -> 'session' ->> 'id')::uuid), tests.put('tokEva', (r -> 'participant' ->> 'token')::uuid) from s_matola2;
select tests.login('ownerA'); set role authenticated;
select public.close_table_session(tests.id('sessMatola2'));
reset role;
select tests.login(null); set role anon;
create temp table c_matola2 as select public.get_session_closure(tests.id('sessMatola2'), tests.id('tokEva'), 'mobile') as r;
reset role;
select tests.ok('sessão do Sabores Matola usa o link do Sabores Matola (nunca o do Maputo)',
  (select r -> 'reviewRequest' ->> 'url' like '%placeid=ChIJMatola%'
      and r -> 'reviewRequest' ->> 'url' <> 'https://g.page/r/MAPUTO123/review'
      and r -> 'restaurant' ->> 'name' = 'Sabores Matola' from c_matola2)
  and (select restaurant_id = tests.id('matola') and review_url like '%placeid=ChIJMatola%'
       from public.review_requests where table_session_id = tests.id('sessMatola2')));
select tests.login('ownerA'); set role authenticated;
update public.restaurants set google_review_url = 'https://maps.app.goo.gl/MaputoNovo1' where id = tests.id('maputo');
reset role;
select tests.ok('alterar o link de um estabelecimento não altera os outros',
  (select google_review_url from public.restaurants where id = tests.id('matola')) like '%placeid=ChIJMatola%'
  and (select google_review_url from public.restaurants where id = tests.id('beira')) is null);
select tests.ok('a empresa não tem link do Google próprio',
  not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'companies' and column_name like '%google%'));

-- O link usado fica registado mesmo que o estabelecimento o altere depois.
update public.restaurants set google_review_url = 'https://g.page/r/NOVO/review' where id = tests.id('maputo');
select tests.ok('pedido mantém o link utilizado na altura',
  (select review_url from public.review_requests where id = tests.id('reqAna')) = 'https://g.page/r/MAPUTO123/review');

-- ---------------------------------------------------------------------
-- 6. Acesso: cliente sem conta, equipa, outra empresa
-- ---------------------------------------------------------------------
select tests.login(null); set role anon;
select tests.ok('cliente sem conta não lê a tabela', tests.error_hint('select count(*) from public.review_requests') = '42501');
select tests.ok('cliente sem conta não usa o painel',
  tests.error_hint(format('select public.get_review_dashboard(%L)', tests.id('companyA'))) = '42501');
reset role;

select tests.login('ownerA'); set role authenticated;
select tests.ok('dono vê os pedidos da sua empresa', (select count(*) from public.review_requests) = 3);
select tests.ok('dono não cria pedidos diretamente',
  tests.error_hint(format('insert into public.review_requests (restaurant_id, table_session_id, participant_id, review_url) values (%L, %L, %L, %L)',
    tests.id('maputo'), tests.id('sessMaputo'), (select participant_id from public.review_requests limit 1), 'https://g.page/r/x')) = '42501');
create temp table dash_a as select public.get_review_dashboard(tests.id('companyA')) as r;
create temp table dash_maputo as select public.get_review_dashboard(tests.id('companyA'), tests.id('maputo')) as r;
reset role;

select tests.ok('painel: indicadores por estabelecimento',
  (select (x ->> 'closedSessions')::int = 1 and (x ->> 'requestedSessions')::int = 1 and (x ->> 'presented')::int = 2
      and (x ->> 'opened')::int = 1 and (x ->> 'forwarded')::int = 2 and (x ->> 'autoRedirected')::int = 1
      and (x ->> 'reached')::int = 2 and (x ->> 'hasReviewUrl')::boolean
   from dash_a, jsonb_array_elements(r -> 'byRestaurant') x where x ->> 'restaurantName' = 'Sabores Maputo'));
select tests.ok('painel: estabelecimento sem link e sessão "não solicitada"',
  (select (x ->> 'closedSessions')::int = 1 and (x ->> 'presented')::int = 0 and not (x ->> 'hasReviewUrl')::boolean
   from dash_a, jsonb_array_elements(r -> 'byRestaurant') x where x ->> 'restaurantName' = 'Sabores Beira'));
select tests.ok('painel: sessões canceladas não contam como encerradas (Matola: 1 encerrada, 1 cancelada)',
  (select (x ->> 'closedSessions')::int = 1 and (x ->> 'presented')::int = 1
   from dash_a, jsonb_array_elements(r -> 'byRestaurant') x where x ->> 'restaurantName' = 'Sabores Matola'));
select tests.ok('painel: últimas solicitações com mesa e dispositivo',
  (select jsonb_array_length(r -> 'recent') = 3 from dash_a)
  and (select bool_and(x ->> 'tableNumber' = '01' and x ->> 'restaurantName' in ('Sabores Maputo', 'Sabores Matola')) from dash_a, jsonb_array_elements(r -> 'recent') x));
select tests.ok('painel: filtro por estabelecimento',
  (select jsonb_array_length(r -> 'byRestaurant') = 1 from dash_maputo));

select tests.login('waiterA'); set role authenticated;
select tests.ok('garçom não vê os pedidos de avaliação', (select count(*) from public.review_requests) = 0);
select tests.ok('garçom não vê o painel',
  (select jsonb_array_length(public.get_review_dashboard(tests.id('companyA')) -> 'byRestaurant') = 0));
reset role;

select tests.login('ownerB'); set role authenticated;
select tests.ok('outra empresa não vê os pedidos', (select count(*) from public.review_requests) = 0);
select tests.ok('outra empresa não vê o painel da empresa A',
  (select jsonb_array_length(public.get_review_dashboard(tests.id('companyA')) -> 'byRestaurant') = 0
      and jsonb_array_length(public.get_review_dashboard(tests.id('companyA')) -> 'recent') = 0));
reset role;

-- ---------------------------------------------------------------------
-- 7. Eliminação da empresa remove os pedidos de avaliação
-- ---------------------------------------------------------------------
select tests.login('super'); set role authenticated;
select public.admin_delete_company(tests.id('companyA'), 'Sabores de Moçambique');
reset role;
select tests.ok('eliminar a empresa remove os pedidos de avaliação', not exists (select 1 from public.review_requests));

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
