-- =====================================================================
-- Testes: Modo Grupo — conta individual e colectiva (migração 1800).
--
-- Executar com:  npm run test:db -- group_mode
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

-- Estabelecimento A: mesas 12 e 13, produtos do exemplo. B: mesa 01.
insert into public.restaurants (company_id, name, slug) values (tests.id('companyA'), 'Restaurante A', '') returning tests.put('restA', id);
insert into public.restaurants (company_id, name, slug) values (tests.id('companyB'), 'Restaurante B', '') returning tests.put('restB', id);
update public.restaurants set tax_rate = 16;
insert into public.dining_tables (restaurant_id, number) values (tests.id('restA'), '12') returning tests.put('t12', id);
insert into public.dining_tables (restaurant_id, number) values (tests.id('restA'), '13') returning tests.put('t13', id);
insert into public.dining_tables (restaurant_id, number) values (tests.id('restB'), '01') returning tests.put('tB', id);
insert into public.categories (restaurant_id, name) values (tests.id('restA'), 'Tudo') returning tests.put('catA', id);
insert into public.categories (restaurant_id, name) values (tests.id('restB'), 'Tudo') returning tests.put('catB', id);
create function tests.product(p_key text, p_rest text, p_cat text, p_name text, p_price numeric) returns void language sql as $$
  insert into public.products (restaurant_id, category_id, name, price) values (tests.id(p_rest), tests.id(p_cat), p_name, p_price)
  returning tests.put(p_key, id) $$;
select tests.product('hamb', 'restA', 'catA', 'Hambúrguer', 450);
select tests.product('coca', 'restA', 'catA', 'Coca-Cola', 100);
select tests.product('pizza', 'restA', 'catA', 'Pizza', 400);
select tests.product('agua', 'restA', 'catA', 'Água', 100);
select tests.product('frango', 'restA', 'catA', 'Frango grelhado', 350);
select tests.product('salada', 'restA', 'catA', 'Salada', 150);
select tests.product('sumo', 'restA', 'catA', 'Sumo', 100);
select tests.product('pratoB', 'restB', 'catB', 'Prato B', 500);

-- ---------------------------------------------------------------------
-- 1–3. João inicia (NFC), Maria e Carlos entram (QR / NFC), Ana entra
-- ---------------------------------------------------------------------
create function tests.start(p_table text, p_name text, p_sess text, p_tok text, p_part text) returns void language plpgsql as $$
declare v jsonb;
begin
  perform tests.login(null);
  v := public.start_table_session(tests.id(p_table), p_name);
  perform tests.put(p_sess, (v -> 'session' ->> 'id')::uuid);
  perform tests.put(p_tok, (v -> 'participant' ->> 'token')::uuid);
  perform tests.put(p_part, (v -> 'participant' ->> 'id')::uuid);
end $$;
create function tests.join(p_sess text, p_name text, p_tok text, p_part text, p_avatar text default null) returns void language plpgsql as $$
declare v jsonb;
begin
  perform tests.login(null);
  v := public.join_table_session(tests.id(p_sess), p_name, p_avatar);
  perform tests.put(p_tok, (v -> 'participant' ->> 'token')::uuid);
  perform tests.put(p_part, (v -> 'participant' ->> 'id')::uuid);
end $$;
create function tests.order(p_sess text, p_tok text, p_key text, p_items jsonb) returns void language plpgsql as $$
begin
  perform tests.login(null);
  perform tests.put(p_key, (public.place_order(tests.id(p_sess), tests.id(p_tok), p_items) ->> 'id')::uuid);
end $$;
create function tests.item(p_prod text, p_qty int default 1) returns jsonb language sql stable as $$
  select jsonb_build_object('productId', tests.id(p_prod), 'quantity', p_qty) $$;

set role anon;
select tests.start('t12', 'João', 's12', 'tokJoao', 'pJoao');
select tests.join('s12', 'Maria', 'tokMaria', 'pMaria', 'rose');
select tests.join('s12', 'Carlos', 'tokCarlos', 'pCarlos');
select tests.join('s12', 'Ana', 'tokAna', 'pAna', 'Teal');
select tests.start('tB', 'Eva', 'sB', 'tokEva', 'pEva');
reset role;

select tests.ok('uma só sessão para a mesa, com quatro participantes',
  (select count(*) = 1 from public.table_sessions where table_id = tests.id('t12'))
  and (select count(*) = 4 from public.session_participants where session_id = tests.id('s12')));
select tests.ok('cada participante tem identificador e token próprios',
  (select count(distinct id) = 4 and count(distinct token) = 4 from public.session_participants where session_id = tests.id('s12')));
select tests.ok('o primeiro participante (João) é o organizador',
  (select bool_and(is_primary = (name = 'João')) from public.session_participants where session_id = tests.id('s12')));
select tests.ok('avatar opcional guardado normalizado; inválido ignorado',
  (select avatar = 'rose' from public.session_participants where id = tests.id('pMaria'))
  and (select avatar = 'teal' from public.session_participants where id = tests.id('pAna'))
  and (select avatar is null from public.session_participants where id = tests.id('pCarlos')));

-- ---------------------------------------------------------------------
-- 4–5. Cada um pede do seu telemóvel; o restaurante vê quem pediu
-- ---------------------------------------------------------------------
set role anon;
select tests.order('s12', 'tokJoao', 'oJoao', jsonb_build_array(tests.item('hamb'), tests.item('coca')));
select tests.order('s12', 'tokMaria', 'oMaria', jsonb_build_array(tests.item('pizza'), tests.item('agua')));
select tests.order('s12', 'tokCarlos', 'oCarlos', jsonb_build_array(tests.item('frango')));
select tests.order('s12', 'tokAna', 'oAna', jsonb_build_array(tests.item('salada'), tests.item('sumo')));
reset role;

select tests.ok('cada pedido guarda o participante que o fez',
  (select participant_id = tests.id('pJoao') from public.orders where id = tests.id('oJoao'))
  and (select participant_id = tests.id('pMaria') from public.orders where id = tests.id('oMaria'))
  and (select participant_id = tests.id('pAna') from public.orders where id = tests.id('oAna')));
select tests.login('ownerA'); set role authenticated;
select tests.ok('painel/cozinha: o pedido mostra o nome do participante',
  (select (public.update_order_status(tests.id('oCarlos'), 'preparing') ->> 'participantName') = 'Carlos'));
reset role;

-- ---------------------------------------------------------------------
-- 6. Subtotais calculados no servidor
-- ---------------------------------------------------------------------
select tests.ok('total colectivo = soma dos pedidos (1650 MT)',
  (select (tests.bill('s12', 'tokMaria') -> 'totals' ->> 'total')::numeric = 1650));
select tests.ok('consumos individuais: João 550, Maria 500, Carlos 350, Ana 250',
  (select (tests.person(b, 'João') ->> 'consumption')::numeric = 550
      and (tests.person(b, 'Maria') ->> 'consumption')::numeric = 500
      and (tests.person(b, 'Carlos') ->> 'consumption')::numeric = 350
      and (tests.person(b, 'Ana') ->> 'consumption')::numeric = 250
   from (select tests.bill('s12', 'tokJoao') as b) x));
select tests.ok('a conta identifica quem está a ver',
  (select tests.person(tests.bill('s12', 'tokAna'), 'Ana') ->> 'isMe' = 'true'
      and tests.person(tests.bill('s12', 'tokAna'), 'João') ->> 'isMe' = 'false'));
select tests.ok('cliente de outra mesa não abre a conta desta sessão',
  tests.error_hint(format('select public.get_session_bill(%L, %L)', tests.id('s12'), tests.id('tokEva'))) = 'not_participant');
select tests.ok('sem token, a conta não abre',
  tests.error_hint(format('set local role anon; select public.get_session_bill(%L, null)', tests.id('s12'))) = 'not_participant');

-- ---------------------------------------------------------------------
-- 7. Maria paga apenas o seu consumo
-- ---------------------------------------------------------------------
select tests.put('payMaria', (tests.pay('s12', 'tokMaria', 'own') ->> 'paymentId')::uuid);
select tests.ok('Maria: pagamento de 500 MT, a aguardar confirmação da equipa',
  (select amount = 500 and status = 'awaiting_confirmation' and split_mode = 'own' and participant_id = tests.id('pMaria')
   from public.payments where id = tests.id('payMaria')));
select tests.ok('Maria: nada mais em aberto; o resto da mesa continua em aberto (1150)',
  (select (tests.person(b, 'Maria') ->> 'outstanding')::numeric = 0
      and (b -> 'totals' ->> 'outstanding')::numeric = 1150
      and (b -> 'totals' ->> 'reserved')::numeric = 500
   from (select tests.bill('s12', 'tokMaria') as b) x));
select tests.ok('Maria não consegue pagar o seu consumo duas vezes',
  tests.error_hint(format($q$select public.create_session_payment(%L, %L, 'own', 'mpesa')$q$, tests.id('s12'), tests.id('tokMaria'))) = 'nothing_to_pay');
select tests.ok('João não consegue pagar a pizza que a Maria já está a pagar (sem cobrança dupla)',
  tests.error_hint(format($q$select public.create_session_payment(%L, %L, 'items', 'cash', %L)$q$,
    tests.id('s12'), tests.id('tokJoao'),
    jsonb_build_array(jsonb_build_object('itemId', (select id from public.order_items where order_id = tests.id('oMaria') and product_name = 'Pizza'), 'quantity', 1)))) = 'item_not_payable');
select tests.ok('não se paga produto de outra mesa/empresa por aqui',
  tests.error_hint(format($q$select public.create_session_payment(%L, %L, 'items', 'cash', %L)$q$,
    tests.id('s12'), tests.id('tokJoao'),
    jsonb_build_array(jsonb_build_object('itemId', gen_random_uuid(), 'quantity', 1)))) = 'item_not_payable');

-- A equipa só confirma depois da entrega.
select tests.login('ownerA'); set role authenticated;
select tests.ok('confirmar antes da entrega é recusado',
  tests.error_hint(format($q$update public.payments set status = 'paid' where id = %L$q$, tests.id('payMaria'))) = 'payment_before_delivery');
select public.update_order_status(id, 'delivered') from public.orders where table_session_id = tests.id('s12');
update public.payments set status = 'paid' where id = tests.id('payMaria');
reset role;
select tests.ok('Maria pago: o pedido dela fica Pago, os outros continuam pendentes',
  (select payment_status = 'paid' from public.orders where id = tests.id('oMaria'))
  and (select bool_and(payment_status = 'pending') from public.orders where id in (tests.id('oJoao'), tests.id('oCarlos'), tests.id('oAna'))));
select tests.ok('não foi criado um segundo pagamento para o pedido da Maria',
  (select count(*) = 1 from public.payments where table_session_id = tests.id('s12') or order_id = tests.id('oMaria')));
select tests.ok('aviso de pagamento confirmado identifica quem pagou (um por pagamento)',
  (select count(*) = 4 and bool_and(payload ->> 'participantId' = tests.id('pMaria')::text)
   from realtime.messages where event = 'payment.confirmed'));
select tests.ok('Maria: consumo 500, pago 500, pendente 0',
  (select (p ->> 'paid')::numeric = 500 and (p ->> 'pending')::numeric = 0
   from (select tests.person(tests.bill('s12', 'tokJoao'), 'Maria') as p) x));

-- ---------------------------------------------------------------------
-- 8. João paga parte (só o hambúrguer)
-- ---------------------------------------------------------------------
select tests.put('payJoao', (tests.pay('s12', 'tokJoao', 'items',
  jsonb_build_array(jsonb_build_object('itemId', (select id from public.order_items where order_id = tests.id('oJoao') and product_name = 'Hambúrguer'), 'quantity', 1)))
  ->> 'paymentId')::uuid);
select tests.ok('João paga só o hambúrguer: 450 MT; a Coca-Cola continua em aberto',
  (select amount = 450 from public.payments where id = tests.id('payJoao'))
  and (select (tests.person(tests.bill('s12', 'tokJoao'), 'João') ->> 'outstanding')::numeric = 100));

-- 9. Carlos divide igualmente o que falta entre quem ainda não pagou (Carlos e Ana)
select tests.ok('parte igual = 700 em aberto ÷ 2 pessoas = 350',
  (select (b ->> 'equalShare')::numeric = 350 and (b ->> 'equalPayers')::int = 2 from (select tests.bill('s12', 'tokCarlos') as b) x));
select tests.put('payCarlos', (tests.pay('s12', 'tokCarlos', 'equal') ->> 'paymentId')::uuid);
select tests.ok('Carlos paga 350 MT (parte igual), repartido pelos itens em aberto',
  (select amount = 350 from public.payments where id = tests.id('payCarlos'))
  and (select sum(amount) = 350 from public.payment_allocations where payment_id = tests.id('payCarlos')));

-- 10. Ana paga tudo o que falta
select tests.put('payAna', (tests.pay('s12', 'tokAna', 'all') ->> 'paymentId')::uuid);
select tests.ok('Ana paga o resto (350 MT) e a conta fica toda coberta, sem valores duplicados',
  (select amount = 350 from public.payments where id = tests.id('payAna'))
  and (select (b -> 'totals' ->> 'outstanding')::numeric = 0
          and (b -> 'totals' ->> 'paid')::numeric + (b -> 'totals' ->> 'reserved')::numeric = 1650
       from (select tests.bill('s12', 'tokAna') as b) x)
  and (select sum(amount) = 1650 from public.payments where table_session_id = tests.id('s12') and status <> 'failed'));
select tests.ok('nenhum item fica cobrado acima do seu valor',
  not exists (select 1 from public.payment_allocations a join public.order_items i on i.id = a.order_item_id
              where a.table_session_id = tests.id('s12') group by i.id, i.total_price having sum(a.amount) > i.total_price));
select tests.ok('com tudo coberto, "pagar tudo" já não cobra nada',
  tests.error_hint(format($q$select public.create_session_payment(%L, %L, 'all', 'cash')$q$, tests.id('s12'), tests.id('tokJoao'))) = 'nothing_to_pay');

-- 11. Cancelar o próprio pagamento (e só o próprio)
select tests.ok('Ana não cancela o pagamento do Carlos',
  tests.error_hint(format('select public.cancel_session_payment(%L, %L)', tests.id('payCarlos'), tests.id('tokAna'))) = 'forbidden');
select tests.login(null);
select public.cancel_session_payment(tests.id('payAna'), tests.id('tokAna'));
select tests.ok('Ana cancela o seu pagamento: os 350 MT voltam a estar em aberto',
  (select status = 'failed' from public.payments where id = tests.id('payAna'))
  and (select (tests.bill('s12', 'tokAna') -> 'totals' ->> 'outstanding')::numeric = 350));
select tests.ok('não se cancela um pagamento já confirmado',
  tests.error_hint(format('select public.cancel_session_payment(%L, %L)', tests.id('payMaria'), tests.id('tokMaria'))) = 'payment_already_confirmed');

-- 12. Sair da sessão: só sem valores pendentes; o organizador passa a outro
select tests.ok('Ana não sai com consumo por pagar',
  tests.error_hint(format('select public.leave_table_session(%L, %L)', tests.id('s12'), tests.id('tokAna'))) = 'participant_has_pending');
select tests.ok('pedir a conta sem pagar: só o organizador',
  tests.error_hint(format('set local role anon; select public.request_bill(%L, %L)', tests.id('s12'), tests.id('tokCarlos'))) = 'organizer_only'
  and tests.error_hint(format('set local role anon; select public.request_bill(%L, %L)', tests.id('s12'), tests.id('tokJoao'))) = '');
reset role;
select tests.put('payAna2', (tests.pay('s12', 'tokAna', 'own') ->> 'paymentId')::uuid);
select tests.put('payJoao2', (tests.pay('s12', 'tokJoao', 'all') ->> 'paymentId')::uuid);
select tests.ok('a parte igual do Carlos foi repartida: falta 225 MT, que o João paga (uma pessoa paga o resto)',
  (select amount = 225 from public.payments where id = tests.id('payJoao2')));
select tests.login('ownerA'); set role authenticated;

-- 13. Fecho: bloqueado enquanto houver valores por confirmar
select tests.ok('a mesa não fecha com pagamentos ainda por confirmar',
  tests.error_hint(format('select public.close_table_session(%L)', tests.id('s12'))) = 'session_has_pending');
update public.payments set status = 'paid' where id in (tests.id('payJoao'), tests.id('payCarlos'), tests.id('payAna2'), tests.id('payJoao2'));
reset role;
select tests.ok('tudo confirmado: todos os pedidos pagos e pendente 0',
  (select bool_and(payment_status = 'paid') from public.orders where table_session_id = tests.id('s12'))
  and (select (tests.bill('s12', 'tokJoao') -> 'totals' ->> 'pending')::numeric = 0));
select tests.login(null);
select public.leave_table_session(tests.id('s12'), tests.id('tokJoao'));
select tests.ok('João sai (sem pendentes): token deixa de funcionar e o organizador passa à Maria',
  tests.error_hint(format('select public.get_session_bill(%L, %L)', tests.id('s12'), tests.id('tokJoao'))) = 'not_participant'
  and (select is_primary from public.session_participants where id = tests.id('pMaria')));

-- 14. Revogação pela equipa
select tests.login('ownerA'); set role authenticated;
select public.revoke_session_participant(tests.id('pCarlos'), 'Telemóvel perdido');
reset role;
select tests.login(null);
select tests.ok('participante revogado não volta a pedir nem a ver a conta',
  tests.error_hint(format($q$select public.place_order(%L, %L, %L)$q$, tests.id('s12'), tests.id('tokCarlos'),
    jsonb_build_array(jsonb_build_object('productId', tests.id('coca'), 'quantity', 1)))) = 'not_participant'
  and not private.can_receive_customer_topic('customer:' || tests.id('tokCarlos')));
select tests.ok('revogação registada na auditoria',
  exists (select 1 from public.audit_logs where action = 'session.participant_revoked' and details like '%Telemóvel perdido%'));
select tests.ok('cliente não revoga participantes',
  tests.error_hint(format('set local role anon; select public.revoke_session_participant(%L)', tests.id('pAna'))) = '42501');

select tests.login('ownerA'); set role authenticated;
select tests.ok('fechar a sessão sem pendentes não dá erro',
  tests.error_hint(format('select public.close_table_session(%L)', tests.id('s12'))) = '');
reset role;
select tests.ok('sem pendentes, a sessão fecha normalmente',
  (select status = 'closed' and unpaid_at_close is null from public.table_sessions where id = tests.id('s12')));

-- ---------------------------------------------------------------------
-- 15. Divisão igual com arredondamento (1000 MT ÷ 3)
-- ---------------------------------------------------------------------
set role anon;
select tests.start('t13', 'Xavier', 's13', 'tokX', 'pX');
select tests.join('s13', 'Yara', 'tokY', 'pY');
select tests.join('s13', 'Zé', 'tokZ', 'pZ');
select tests.order('s13', 'tokX', 'oX', jsonb_build_array(tests.item('hamb', 2), tests.item('coca')));
reset role;
select tests.put('payX', (tests.pay('s13', 'tokX', 'equal') ->> 'paymentId')::uuid);
select tests.put('payY', (tests.pay('s13', 'tokY', 'equal') ->> 'paymentId')::uuid);
select tests.put('payZ', (tests.pay('s13', 'tokZ', 'equal') ->> 'paymentId')::uuid);
select tests.ok('1000 MT ÷ 3: as três partes somam exactamente 1000 (diferença de arredondamento tratada)',
  (select sum(amount) = 1000 and max(amount) - min(amount) <= 0.01 and count(*) = 3
   from public.payments where id in (tests.id('payX'), tests.id('payY'), tests.id('payZ'))));

-- ---------------------------------------------------------------------
-- 16. Fecho forçado: só gerente, com motivo, registado
-- ---------------------------------------------------------------------
select tests.login('ownerA'); set role authenticated;
select tests.ok('fecho forçado sem motivo é recusado',
  tests.error_hint(format('select public.close_table_session(%L, true, null)', tests.id('s13'))) = 'reason_required');
select public.close_table_session(tests.id('s13'), true, 'Cliente saiu sem pagar');
reset role;
select tests.ok('fecho forçado guarda o valor em falta e o motivo, e fica na auditoria',
  (select status = 'closed' and unpaid_at_close = 1000 and forced_close_reason = 'Cliente saiu sem pagar'
   from public.table_sessions where id = tests.id('s13'))
  and exists (select 1 from public.audit_logs where action = 'session.force_closed' and details like '%Cliente saiu sem pagar%'));

-- ---------------------------------------------------------------------
-- 17. Isolamento entre empresas e dados internos
-- ---------------------------------------------------------------------
select tests.login('ownerB'); set role authenticated;
select tests.ok('empresa B não vê as alocações nem os pagamentos da empresa A',
  (select count(*) = 0 from public.payment_allocations) and (select count(*) = 0 from public.payments));
select tests.ok('empresa B não abre a conta da sessão da A',
  tests.error_hint(format('select public.get_session_bill(%L, null)', tests.id('s12'))) = 'not_participant');
select tests.ok('empresa B não revoga participantes da A',
  tests.error_hint(format('select public.revoke_session_participant(%L)', tests.id('pAna'))) = 'forbidden');
reset role;
select tests.ok('clientes (anon) não leem as alocações',
  tests.error_hint('set local role anon; select count(*) from public.payment_allocations') = '42501');

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
