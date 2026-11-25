-- =====================================================================
-- Testes: garçons responsáveis pelas mesas (migração 2000).
--
-- Executar com:  npm run test:db -- table_assignments
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



/** Executa uma expressão como um utilizador (null = cliente anónimo) e devolve o jsonb. */
create function tests.call(p_user text, p_expr text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform tests.login(p_user);
  if p_user is null then set local role anon; else set local role authenticated; end if;
  execute 'select (' || p_expr || ')::jsonb' into v;
  reset role;
  return v;
end $$;
/** Executa SQL como um utilizador e devolve o hint do erro ('' se não falhar). */
create function tests.hint(p_user text, p_sql text) returns text language plpgsql as $$
declare v_hint text;
begin
  perform tests.login(p_user);
  if p_user is null then set local role anon; else set local role authenticated; end if;
  execute p_sql;
  reset role;
  return '';
exception when others then
  get stacked diagnostics v_hint = pg_exception_hint;
  return coalesce(nullif(v_hint, ''), sqlstate);
end $$;
/** Mesa do painel operacional, vista por um utilizador. */
create function tests.op_table(p_user text, p_rest text, p_table text) returns jsonb language sql as $$
  select t from jsonb_array_elements(tests.call(p_user, format('public.get_table_operations(tests.id(%L))', p_rest)) -> 'tables') t
  where (t ->> 'id')::uuid = tests.id(p_table) $$;
create function tests.primary_name(p_table text) returns text language sql as $$
  select m.name from public.table_staff_assignments a join public.staff_members m on m.id = a.staff_id
  where a.table_id = tests.id(p_table) and a.active and a.role = 'primary' $$;
/** Guarda o resultado de um passo para verificar a seguir (as subconsultas
 *  de uma mesma instrução correm antes da chamada). */
create table tests.kept (k text primary key, v jsonb);
create function tests.keep(p_key text, p_val jsonb) returns void language sql as $$
  insert into tests.kept values (p_key, p_val) on conflict (k) do update set v = excluded.v $$;
create function tests.got(p_key text) returns jsonb language sql stable as $$ select v from tests.kept where k = p_key $$;
grant all on tests.kept to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------
-- Estabelecimentos, mesas e equipa
-- ---------------------------------------------------------------------
insert into public.restaurants (company_id, name, slug) values (tests.id('companyA'), 'Centro', '') returning tests.put('rC', id);
insert into public.restaurants (company_id, name, slug) values (tests.id('companyA'), 'Praia', '') returning tests.put('rP', id);
insert into public.restaurants (company_id, name, slug) values (tests.id('companyB'), 'Casa B', '') returning tests.put('rB', id);
insert into public.dining_tables (restaurant_id, number) values (tests.id('rC'), '1') returning tests.put('tC1', id);
insert into public.dining_tables (restaurant_id, number) values (tests.id('rC'), '2') returning tests.put('tC2', id);
insert into public.dining_tables (restaurant_id, number) values (tests.id('rC'), '12') returning tests.put('tC12', id);
insert into public.dining_tables (restaurant_id, number) values (tests.id('rP'), '1') returning tests.put('tP1', id);
insert into public.dining_tables (restaurant_id, number) values (tests.id('rB'), '1') returning tests.put('tB1', id);
insert into public.categories (restaurant_id, name) values (tests.id('rC'), 'Pratos') returning tests.put('cat', id);
insert into public.products (restaurant_id, category_id, name, price) values (tests.id('rC'), tests.id('cat'), 'Hambúrguer', 450) returning tests.put('burger', id);
insert into public.products (restaurant_id, category_id, name, price) values (tests.id('rC'), tests.id('cat'), 'Pizza', 800) returning tests.put('pizza', id);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  (tests.put('uGerente', gen_random_uuid()), 'gerente@a.test', now(), '{"full_name":"Gerente Ana"}'),
  (tests.put('uJoao',    gen_random_uuid()), 'joao@a.test',    now(), '{"full_name":"João"}'),
  (tests.put('uCarlos',  gen_random_uuid()), 'carlos@a.test',  now(), '{"full_name":"Carlos"}'),
  (tests.put('uMaria',   gen_random_uuid()), 'maria@a.test',   now(), '{"full_name":"Maria"}'),
  (tests.put('uCozinha', gen_random_uuid()), 'cozinha@a.test', now(), '{"full_name":"Cozinha"}'),
  (tests.put('uCaixa',   gen_random_uuid()), 'caixa@a.test',   now(), '{"full_name":"Caixa"}'),
  (tests.put('uGarcomB', gen_random_uuid()), 'garcom@b.test',  now(), '{"full_name":"Garçom B"}');

insert into public.staff_members (company_id, user_id, name, email, role, restaurant_ids) values
  (tests.id('companyA'), tests.id('uGerente'), 'Gerente Ana', 'gerente@a.test', 'manager', array[tests.id('rC')]) returning tests.put('gerente', id);
insert into public.staff_members (company_id, user_id, name, email, role, restaurant_ids) values
  (tests.id('companyA'), tests.id('uJoao'), 'João', 'joao@a.test', 'waiter', array[tests.id('rC')]) returning tests.put('joao', id);
insert into public.staff_members (company_id, user_id, name, email, role, restaurant_ids) values
  (tests.id('companyA'), tests.id('uCarlos'), 'Carlos', 'carlos@a.test', 'waiter', array[tests.id('rC')]) returning tests.put('carlos', id);
-- Pedro não tem conta nem smartphone.
insert into public.staff_members (company_id, user_id, name, email, role, restaurant_ids) values
  (tests.id('companyA'), null, 'Pedro', 'pedro@a.test', 'waiter', array[tests.id('rC')]) returning tests.put('pedro', id);
insert into public.staff_members (company_id, user_id, name, email, role, restaurant_ids) values
  (tests.id('companyA'), tests.id('uMaria'), 'Maria', 'maria@a.test', 'waiter', array[tests.id('rP')]) returning tests.put('maria', id);
insert into public.staff_members (company_id, user_id, name, email, role, restaurant_ids) values
  (tests.id('companyA'), tests.id('uCozinha'), 'Cozinha', 'cozinha@a.test', 'kitchen_staff', array[tests.id('rC')]) returning tests.put('cozinha', id);
insert into public.staff_members (company_id, user_id, name, email, role, restaurant_ids) values
  (tests.id('companyA'), tests.id('uCaixa'), 'Caixa', 'caixa@a.test', 'receptionist', array[tests.id('rC')]) returning tests.put('caixa', id);
insert into public.staff_members (company_id, user_id, name, email, role, restaurant_ids) values
  (tests.id('companyB'), tests.id('uGarcomB'), 'Garçom B', 'garcom@b.test', 'waiter', array[tests.id('rB')]) returning tests.put('garcomB', id);

-- ---------------------------------------------------------------------
-- 1. Atribuição (gerente/supervisor)
-- ---------------------------------------------------------------------
select tests.ok('gerente atribui várias mesas ao mesmo garçom de uma vez',
  (tests.call('uGerente', $$public.assign_table_staff(array[tests.id('tC1'), tests.id('tC2')], tests.id('joao'))$$) ->> 'assigned')::int = 2);
select tests.call('uGerente', $$public.assign_table_staff(array[tests.id('tC12')], tests.id('carlos'))$$);
select tests.keep('h', to_jsonb(tests.hint('uGerente', $$select public.assign_table_staff(array[tests.id('tC12')], tests.id('pedro'), 'support')$$)));
select tests.ok('mesma mesa com principal e apoio — o apoio pode não ter conta nem smartphone',
  tests.got('h') #>> '{}' = ''
  and (select count(*) from public.table_staff_assignments where table_id = tests.id('tC12') and active) = 2);
select tests.ok('garçom não atribui mesas',
  tests.hint('uJoao', $$select public.assign_table_staff(array[tests.id('tC12')], tests.id('joao'))$$) = 'forbidden');
select tests.ok('funcionário de outro estabelecimento não pode ficar com a mesa',
  tests.hint('uGerente', $$select public.assign_table_staff(array[tests.id('tC1')], tests.id('maria'), 'support')$$) = 'invalid_staff');
select tests.ok('cozinha não atende mesas',
  tests.hint('uGerente', $$select public.assign_table_staff(array[tests.id('tC1')], tests.id('cozinha'), 'support')$$) = 'invalid_staff');
select tests.ok('funcionário de outra empresa é recusado',
  tests.hint('uGerente', $$select public.assign_table_staff(array[tests.id('tC1')], tests.id('garcomB'), 'support')$$) = 'invalid_staff');
select tests.ok('dono de outra empresa não mexe nas mesas da empresa A',
  tests.hint('ownerB', $$select public.assign_table_staff(array[tests.id('tC1')], tests.id('garcomB'))$$) = 'forbidden');
select tests.ok('gerente não atribui mesas de um estabelecimento a que não tem acesso',
  tests.hint('uGerente', $$select public.assign_table_staff(array[tests.id('tP1')], tests.id('maria'))$$) = 'forbidden');
select tests.ok('atribuição temporária com mais de 7 dias é recusada',
  tests.hint('uGerente', $$select public.assign_table_staff(array[tests.id('tC1')], tests.id('carlos'), 'support', now() + interval '8 days')$$) = 'invalid_expiry');
select tests.ok('não se escreve diretamente na tabela de atribuições',
  tests.hint('uGerente', $$insert into public.table_staff_assignments (restaurant_id, table_id, staff_id) values (tests.id('rC'), tests.id('tC1'), tests.id('carlos'))$$) = '42501');

-- ---------------------------------------------------------------------
-- 2. Quem vê o quê
-- ---------------------------------------------------------------------
select tests.ok('garçom vê só as suas mesas',
  (select jsonb_array_length(v -> 'tables') = 2 and v -> 'me' ->> 'scope' = 'assigned'
   from tests.call('uJoao', $$public.get_table_operations(tests.id('rC'))$$) v));
select tests.ok('caixa vê todas as mesas (pagamento e fecho)',
  (select jsonb_array_length(v -> 'tables') = 3 and v -> 'me' ->> 'scope' = 'all' and not (v -> 'me' ->> 'canManage')::boolean
   from tests.call('uCaixa', $$public.get_table_operations(tests.id('rC'))$$) v));
select tests.ok('gerente vê todas e pode gerir',
  (select jsonb_array_length(v -> 'tables') = 3 and (v -> 'me' ->> 'canManage')::boolean
   from tests.call('uGerente', $$public.get_table_operations(tests.id('rC'))$$) v));
select tests.ok('cozinha não tem acesso ao painel de mesas',
  tests.hint('uCozinha', $$select public.get_table_operations(tests.id('rC'))$$) = 'forbidden');
select tests.ok('outra empresa não vê as mesas',
  tests.hint('ownerB', $$select public.get_table_operations(tests.id('rC'))$$) = 'forbidden');
select tests.ok('cliente anónimo não chama o painel',
  tests.hint(null, $$select public.get_table_operations(tests.id('rC'))$$) = '42501');
do $$
declare v_count int;
begin
  perform tests.login('uJoao');
  set local role authenticated;
  select count(*) into v_count from public.table_staff_assignments;
  reset role;
  perform tests.ok('RLS: o garçom só lê as atribuições das suas mesas', v_count = 2, v_count::text);
end $$;
select tests.ok('equipa disponível para atribuir: sem cozinha, sem outros estabelecimentos, sem emails',
  (select jsonb_array_length(v -> 'staff') = 6 and not (v -> 'staff' -> 0 ? 'email')
     and not exists (select 1 from jsonb_array_elements(v -> 'staff') s where s ->> 'name' in ('Cozinha', 'Maria', 'Garçom B'))
   from tests.call('uGerente', $$public.get_table_operations(tests.id('rC'))$$) v));

-- ---------------------------------------------------------------------
-- 3. Cliente entra pelo NFC/QR (Modo Grupo) e chama o garçom
-- ---------------------------------------------------------------------
create function tests.session(p_table text, p_name text, p_sess text, p_tok text) returns void language plpgsql as $$
declare v jsonb;
begin
  perform tests.login(null);
  v := public.start_table_session(tests.id(p_table), p_name);
  perform tests.put(p_sess, (v -> 'session' ->> 'id')::uuid);
  perform tests.put(p_tok, (v -> 'participant' ->> 'token')::uuid);
end $$;
create function tests.join(p_sess text, p_name text, p_tok text) returns void language plpgsql as $$
declare v jsonb;
begin
  perform tests.login(null);
  v := public.join_table_session(tests.id(p_sess), p_name, null);
  perform tests.put(p_tok, (v -> 'participant' ->> 'token')::uuid);
end $$;
create function tests.order(p_sess text, p_tok text, p_prod text) returns uuid language plpgsql as $$
begin
  perform tests.login(null);
  return (public.place_order(tests.id(p_sess), tests.id(p_tok),
    jsonb_build_array(jsonb_build_object('productId', tests.id(p_prod), 'quantity', 1))) ->> 'id')::uuid;
end $$;
create function tests.call_waiter(p_table text, p_sess text, p_tok text, p_type text default 'waiter_call') returns uuid language plpgsql as $$
begin
  perform tests.login(null);
  return (public.create_service_request(tests.id(p_table), p_type, tests.id(p_sess), tests.id(p_tok)) ->> 'id')::uuid;
end $$;
grant execute on all functions in schema tests to anon, authenticated;

set role anon;
select tests.session('tC12', 'João', 's12', 'tkJoao');
select tests.join('s12', 'Maria', 'tkMaria');
select tests.join('s12', 'Carlos', 'tkCarlosCli');
select tests.put('o12a', tests.order('s12', 'tkJoao', 'burger'));
select tests.put('o12b', tests.order('s12', 'tkMaria', 'pizza'));
reset role;

select tests.ok('Modo Grupo: 3 participantes, pedidos de cada um, um só responsável (Carlos)',
  (select (t -> 'session' ->> 'participants')::int = 3 and (t -> 'orders' ->> 'count')::int = 2
          and (t -> 'orders' ->> 'total')::numeric = 1250
          and (select count(*) from jsonb_array_elements(t -> 'assignments') a where a ->> 'role' = 'primary') = 1
          and t -> 'assignments' -> 0 ->> 'staffName' = 'Carlos'
   from tests.op_table('uGerente', 'rC', 'tC12') t));

select tests.call('uCarlos', $$public.set_staff_duty_status('on_duty')$$);
set role anon;
select tests.put('req1', tests.call_waiter('tC12', 's12', 'tkMaria'));
reset role;
select tests.ok('chamada encaminhada automaticamente para o responsável da mesa',
  (select responsible_staff_id = tests.id('carlos') and responsible_name = 'Carlos' from public.service_requests where id = tests.id('req1')));
select tests.ok('notificação: "Mesa 12 solicita atendimento — Responsável: Carlos · Motivo: Atendimento"',
  (select title = 'Mesa 12 solicita atendimento' and message like 'Responsável: Carlos · Motivo: Atendimento%'
   from public.notifications where service_request_id = tests.id('req1')));
select tests.ok('chamada aparece na mesa do painel',
  (select jsonb_array_length(t -> 'requests') = 1 and t -> 'requests' -> 0 ->> 'responsibleName' = 'Carlos'
   from tests.op_table('uGerente', 'rC', 'tC12') t));
select tests.ok('outro garçom não assume enquanto o responsável está em serviço e a chamada é recente',
  tests.hint('uJoao', $$select public.handle_service_request(tests.id('req1'), 'take_over')$$) = 'not_responsible');
select tests.ok('garçom não regista ações em nome de outro',
  tests.hint('uCarlos', $$select public.handle_service_request(tests.id('req1'), 'start', tests.id('pedro'))$$) = 'forbidden');
select tests.ok('responsável marca "recebido" (continua por atender)',
  (select v ->> 'status' = 'new' and v ->> 'acknowledgedAt' is not null and v ->> 'acknowledgedByName' = 'Carlos'
   from tests.call('uCarlos', $$public.handle_service_request(tests.id('req1'), 'acknowledge')$$) v));
select tests.ok('responsável marca "em atendimento"',
  (tests.call('uCarlos', $$public.handle_service_request(tests.id('req1'), 'start')$$) ->> 'status') = 'in_progress');
select tests.keep('r', tests.call('uCarlos', $$public.handle_service_request(tests.id('req1'), 'complete')$$));
select tests.ok('responsável conclui; fica no histórico da mesa',
  tests.got('r') ->> 'status' = 'completed'
  and exists (select 1 from public.table_assignment_events where table_id = tests.id('tC12') and event = 'request_completed' and staff_name = 'Carlos'));
select tests.ok('chamada concluída não volta a mudar',
  tests.hint('uCarlos', $$select public.handle_service_request(tests.id('req1'), 'start')$$) = 'request_closed');
select tests.ok('a equipa já não escreve diretamente nas chamadas',
  tests.hint('uGerente', $$update public.service_requests set status = 'completed' where id = tests.id('req1')$$) = '42501');

-- Garçom sem smartphone: o gerente regista que o Pedro foi atender.
set role anon;
select tests.put('req2', tests.call_waiter('tC12', 's12', 'tkJoao', 'water'));
reset role;
select tests.ok('gerente regista o atendimento em nome do Pedro (sem conta)',
  (select v ->> 'status' = 'in_progress' and v ->> 'assignedToName' = 'Pedro' and (v ->> 'handledByStaffId')::uuid = tests.id('pedro')
   from tests.call('uGerente', $$public.handle_service_request(tests.id('req2'), 'start', tests.id('pedro'))$$) v));
select tests.call('uGerente', $$public.handle_service_request(tests.id('req2'), 'complete')$$);

-- Responsável não responde em 2 minutos: outro garçom assume.
set role anon;
select tests.put('req3', tests.call_waiter('tC12', 's12', 'tkCarlosCli'));
reset role;
update public.service_requests set created_at = now() - interval '3 minutes' where id = tests.id('req3');
select tests.keep('r', tests.call('uJoao', $$public.handle_service_request(tests.id('req3'), 'take_over')$$));
select tests.ok('sem resposta em 2 minutos, outro garçom pode assumir (fica registado)',
  tests.got('r') ->> 'status' = 'in_progress' and tests.got('r') ->> 'assignedToName' = 'João'
  and exists (select 1 from public.table_assignment_events
              where table_id = tests.id('tC12') and event = 'request_taken' and staff_name = 'João' and from_staff_name = 'Carlos'));
select tests.call('uJoao', $$public.handle_service_request(tests.id('req3'), 'complete')$$);

-- Responsável em pausa: a chamada vai para o apoio em serviço.
select tests.call('uCarlos', $$public.set_staff_duty_status('on_break')$$);
select tests.call('uGerente', format('public.set_staff_duty_status(%L, tests.id(%L))', 'on_duty', 'pedro'));
set role anon;
select tests.put('req4', tests.call_waiter('tC12', 's12', 'tkMaria', 'cutlery'));
reset role;
select tests.ok('responsável em pausa: chamada encaminhada para o apoio em serviço (Pedro)',
  (select responsible_name = 'Pedro' from public.service_requests where id = tests.id('req4')));
select tests.ok('gerente muda o turno de quem não tem conta; garçom não muda o de outro',
  (select duty_status = 'on_duty' from public.staff_members where id = tests.id('pedro'))
  and tests.hint('uJoao', $$select public.set_staff_duty_status('absent', tests.id('carlos'))$$) = 'forbidden');

-- ---------------------------------------------------------------------
-- 4. Transferências (sem mexer em pedidos, sessão ou pagamentos)
-- ---------------------------------------------------------------------
select tests.ok('garçom não transfere mesas de outro',
  tests.hint('uJoao', $$select public.transfer_table(tests.id('tC12'), tests.id('joao'))$$) = 'forbidden');

create table tests.before_transfer as
  select (select active_session_id from public.dining_tables where id = tests.id('tC12')) as session_id,
         (select count(*) from public.orders where table_session_id = tests.id('s12')) as orders,
         (select total from public.table_sessions where id = tests.id('s12')) as total;
select tests.keep('r', tests.call('uGerente', $$public.transfer_table(tests.id('tC12'), tests.id('joao'), 'Carlos terminou o turno')$$));
select tests.ok('gerente transfere a Mesa 12 de Carlos para João com motivo',
  (tests.got('r') ->> 'transferred')::int = 1
  and tests.primary_name('tC12') = 'João');
select tests.ok('transferência não altera sessão, pedidos nem total',
  (select b.session_id = t.active_session_id
          and b.orders = (select count(*) from public.orders where table_session_id = tests.id('s12'))
          and b.total = (select total from public.table_sessions where id = tests.id('s12'))
   from tests.before_transfer b, public.dining_tables t where t.id = tests.id('tC12')));
select tests.ok('histórico guarda quem assumiu e a transferência com o motivo',
  (select count(*) filter (where event = 'assigned' and staff_name = 'Carlos') = 1
      and count(*) filter (where event = 'transferred' and from_staff_name = 'Carlos' and staff_name = 'João'
                             and reason = 'Carlos terminou o turno') = 1
   from public.table_assignment_events where table_id = tests.id('tC12')));
select tests.ok('histórico visível pela API para quem vê a mesa (mais recente primeiro)',
  (select v -> 0 ->> 'event' = 'transferred' from tests.call('uJoao', $$public.get_table_assignment_history(tests.id('tC12'))$$) v));
select tests.ok('Carlos (já sem a mesa) deixa de a ver',
  tests.hint('uCarlos', $$select public.get_table_assignment_history(tests.id('tC12'))$$) = 'forbidden');

-- Trocar o responsável pela atribuição: o apoio Pedro passa a principal.
select tests.call('uGerente', $$public.assign_table_staff(array[tests.id('tC12')], tests.id('pedro'), 'primary', null, 'Reforço')$$);
select tests.ok('trocar o responsável: sempre um só principal, o anterior sai',
  tests.primary_name('tC12') = 'Pedro'
  and (select count(*) from public.table_staff_assignments where table_id = tests.id('tC12') and active) = 1);

-- Fim de turno do João: "Transferir minhas mesas" para o Carlos.
select tests.call('uJoao', $$public.set_staff_duty_status('off_duty')$$);
select tests.keep('r', tests.call('uJoao', $$public.transfer_staff_tables(tests.id('rC'), tests.id('carlos'))$$));
select tests.ok('fim de turno: "Transferir minhas mesas" passa todas para outro funcionário',
  (tests.got('r') ->> 'transferred')::int = 2
  and not exists (select 1 from public.table_staff_assignments where staff_id = tests.id('joao') and active)
  and tests.primary_name('tC1') = 'Carlos' and tests.primary_name('tC2') = 'Carlos');
select tests.ok('fim de turno não fecha a sessão da mesa',
  (select status = 'active' from public.table_sessions where id = tests.id('s12')));
select tests.ok('garçom não transfere as mesas de outro funcionário',
  tests.hint('uJoao', $$select public.transfer_staff_tables(tests.id('rC'), tests.id('joao'), null, tests.id('carlos'))$$) = 'forbidden');

-- ---------------------------------------------------------------------
-- 5. Temporária, desativação e fecho
-- ---------------------------------------------------------------------
select tests.call('uGerente', $$public.assign_table_staff(array[tests.id('tC1')], tests.id('pedro'), 'support', now() + interval '1 hour')$$);
update public.table_staff_assignments set expires_at = now() - interval '1 minute'
where table_id = tests.id('tC1') and staff_id = tests.id('pedro') and active;
select tests.keep('r', tests.op_table('uGerente', 'rC', 'tC1'));
select tests.ok('atribuição temporária termina sozinha e fica no histórico',
  jsonb_array_length(tests.got('r') -> 'assignments') = 1
  and exists (select 1 from public.table_assignment_events where table_id = tests.id('tC1') and event = 'expired' and staff_name = 'Pedro'));

select tests.call('uGerente', $$public.close_table_session(tests.id('s12'), true, 'Teste: fecho com valores em aberto')$$);
select tests.ok('fecho da mesa fica no histórico com o responsável; a atribuição continua',
  exists (select 1 from public.table_assignment_events where table_id = tests.id('tC12') and event = 'session_closed' and staff_name = 'Pedro')
  and tests.primary_name('tC12') = 'Pedro');

update public.staff_members set is_active = false where id = tests.id('carlos');
select tests.ok('funcionário desativado perde as atribuições',
  not exists (select 1 from public.table_staff_assignments where staff_id = tests.id('carlos') and active));


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
