-- =====================================================================
-- Testes: notificações em tempo real para o cliente (migração 1300).
--
-- Executar com:  npm run test:db -- customer_notifications
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
/** Mensagens enviadas para o canal de um participante (pelo nome da chave do token). */
create function tests.msgs(p_token_key text, p_event text default null) returns bigint language sql stable as $$
  select count(*) from realtime.messages
  where topic = 'customer:' || tests.id(p_token_key)::text and (p_event is null or event = p_event) $$;
/** Quantas mensagens um cliente anónimo consegue ler ao abrir o canal p_topic (RLS). */
create function tests.anon_can_read(p_topic text) returns bigint language plpgsql as $$
declare v bigint;
begin
  perform set_config('realtime.topic', coalesce(p_topic, ''), true);
  perform tests.login(null);
  set local role anon;
  select count(*) into v from realtime.messages;
  reset role;
  perform set_config('realtime.topic', '', true);
  return v;
end $$;
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
-- Contas, plano, empresas A e B
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

-- Estabelecimentos, mesas e produtos (como superutilizador, só para os dados de teste).
create function tests.seed_restaurant(p_key text, p_company uuid, p_tables text[]) returns void language plpgsql as $$
declare v_rest uuid; v_cat uuid; v_id uuid; v_t text;
begin
  insert into public.restaurants (company_id, name, slug) values (p_company, 'Restaurante ' || p_key, '') returning id into v_rest;
  perform tests.put('rest' || p_key, v_rest);
  foreach v_t in array p_tables loop
    insert into public.dining_tables (restaurant_id, number) values (v_rest, v_t) returning id into v_id;
    perform tests.put('t' || p_key || v_t, v_id);
  end loop;
  insert into public.categories (restaurant_id, name) values (v_rest, 'Pratos') returning id into v_cat;
  insert into public.products (restaurant_id, category_id, name, price) values (v_rest, v_cat, 'Frango', 500) returning id into v_id;
  perform tests.put('prod' || p_key, v_id);
end $$;
select tests.seed_restaurant('A1', tests.id('companyA'), array['01', '02']);
select tests.seed_restaurant('A2', tests.id('companyA'), array['01']);
select tests.seed_restaurant('B1', tests.id('companyB'), array['01']);

-- Sessões (clientes anónimos): mesa A1-01 com dois telemóveis; A1-02; A2-01; B1-01.
create function tests.start(p_table text, p_name text, p_sess text, p_tok text) returns void language plpgsql as $$
declare v jsonb;
begin
  perform tests.login(null);
  v := public.start_table_session(tests.id(p_table), p_name);
  perform tests.put(p_sess, (v -> 'session' ->> 'id')::uuid);
  perform tests.put(p_tok, (v -> 'participant' ->> 'token')::uuid);
end $$;
select tests.start('tA101', 'Ana', 's1', 'tokAna');
select tests.put('tokBruno', (public.join_table_session(tests.id('s1'), 'Bruno') -> 'participant' ->> 'token')::uuid);
select tests.start('tA102', 'Carla', 's2', 'tokCarla');
select tests.start('tA201', 'Dino', 's3', 'tokDino');
select tests.start('tB101', 'Eva', 's4', 'tokEva');

-- Pedidos: Ana (mesa A1-01) e Carla (mesa A1-02).
select tests.login(null);
select tests.put('o1', (public.place_order(tests.id('s1'), tests.id('tokAna'),
  jsonb_build_array(jsonb_build_object('productId', tests.id('prodA1'), 'quantity', 1))) ->> 'id')::uuid);
select tests.put('o2', (public.place_order(tests.id('s2'), tests.id('tokCarla'),
  jsonb_build_array(jsonb_build_object('productId', tests.id('prodA1'), 'quantity', 2))) ->> 'id')::uuid);
select tests.put('o3', (public.place_order(tests.id('s1'), tests.id('tokBruno'),
  jsonb_build_array(jsonb_build_object('productId', tests.id('prodA1'), 'quantity', 1))) ->> 'id')::uuid);

select tests.ok('criar o pedido não gera notificação (o cliente já sabe)', (select count(*) from realtime.messages) = 0);

-- Migração 1600: preços com IVA incluído (refresco a 150 MT custa 150 MT).
update public.restaurants set tax_rate = 16 where id = tests.id('restA2');
select tests.login(null);
select tests.put('oVat', (public.place_order(tests.id('s3'), tests.id('tokDino'),
  jsonb_build_array(jsonb_build_object('productId', tests.id('prodA2'), 'quantity', 2))) ->> 'id')::uuid);
select tests.ok('IVA incluído: o total é a soma dos preços (2 × 500 = 1000 MT, sem acréscimo)',
  (select total = 1000 and subtotal = 1000 from public.orders where id = tests.id('oVat')));
select tests.ok('IVA incluído no preço registado à parte (1000 × 16 ÷ 116 = 137,93 MT)',
  (select tax_amount = 137.93 from public.orders where id = tests.id('oVat')));
select tests.ok('total da sessão = total dos pedidos (sem IVA por cima)',
  (select total = 1000 from public.table_sessions where id = tests.id('s3')));

-- ---------------------------------------------------------------------
-- 1. Mudança de estado pelo funcionário → só a sessão desse pedido
-- ---------------------------------------------------------------------
select tests.login('ownerA'); set role authenticated;
select public.update_order_status(tests.id('o1'), 'preparing');
reset role;

select tests.ok('estado alterado → os dois telemóveis da mesma sessão recebem',
  tests.msgs('tokAna', 'order.status_changed') = 1 and tests.msgs('tokBruno', 'order.status_changed') = 1);
select tests.ok('outra mesa do mesmo estabelecimento não recebe', tests.msgs('tokCarla') = 0);
select tests.ok('outro estabelecimento da mesma empresa não recebe', tests.msgs('tokDino') = 0);
select tests.ok('outra empresa não recebe', tests.msgs('tokEva') = 0);
select tests.ok('mensagem privada, com estado, pedido e eventId determinístico',
  (select bool_and(private and payload ->> 'status' = 'preparing' and payload ->> 'previousStatus' = 'received'
                   and payload ->> 'orderId' = tests.id('o1')::text and payload ->> 'sessionId' = tests.id('s1')::text
                   and payload ->> 'eventId' = tests.id('o1')::text || ':status:preparing')
   from realtime.messages));
select tests.ok('a mensagem não expõe dados de outros clientes (nomes, tokens, totais)',
  (select bool_and(not (payload ? 'customerName') and not (payload ? 'token') and not (payload ? 'total')) from realtime.messages));

-- UPDATE direto (permitido à equipa) também é origem do evento.
select tests.login('ownerA'); set role authenticated;
update public.orders set status = 'ready' where id = tests.id('o1');
-- Repetir o mesmo estado não gera nada.
update public.orders set status = 'ready' where id = tests.id('o1');
select public.update_order_status(tests.id('o2'), 'cancelled');
reset role;
select tests.ok('UPDATE direto do estado também notifica', tests.msgs('tokAna', 'order.status_changed') = 2);
select tests.ok('repetir o mesmo estado não volta a notificar', tests.msgs('tokBruno', 'order.status_changed') = 2);
select tests.ok('pedido cancelado notifica só a sua sessão',
  tests.msgs('tokCarla', 'order.status_changed') = 1 and tests.msgs('tokAna', 'order.status_changed') = 2
  and (select payload ->> 'status' from realtime.messages where topic = 'customer:' || tests.id('tokCarla')) = 'cancelled');

-- ---------------------------------------------------------------------
-- 2. Pagamento confirmado: um aviso por sessão
-- ---------------------------------------------------------------------
-- Migração 1400: só se paga depois de entregue.
select tests.login('ownerA'); set role authenticated;
select tests.ok('pedido novo nasce com pagamento pendente',
  (select payment_status from public.orders where id = tests.id('o3')) = 'pending');
select tests.ok('não se marca como pago um pedido ainda não entregue (Pedidos)',
  tests.error_hint(format('update public.orders set payment_status = %L where id = %L', 'paid', tests.id('o3'))) = 'payment_before_delivery');
select tests.ok('pedido pronto mas não entregue também não pode ser pago',
  tests.error_hint(format('update public.orders set payment_status = %L where id = %L', 'confirmed', tests.id('o1'))) = 'payment_before_delivery');
select tests.ok('confirmar o pagamento em Pagamentos também é recusado antes da entrega',
  tests.error_hint(format('insert into public.payments (restaurant_id, order_id, amount, method, status, transaction_reference) values (%L, %L, 500, %L, %L, %L)',
    tests.id('restA1'), tests.id('o3'), 'cash', 'paid', '')) = 'payment_before_delivery'
  and (select payment_status from public.orders where id = tests.id('o3')) = 'pending'
  and not exists (select 1 from public.payments where order_id = tests.id('o3') and status = 'paid'));
select public.update_order_status(tests.id('o1'), 'delivered');
select public.update_order_status(tests.id('o3'), 'delivered');
update public.orders set payment_status = 'paid' where id in (tests.id('o1'), tests.id('o3'));
reset role;
select tests.ok('depois de entregue, o pagamento pode ficar pago',
  (select bool_and(payment_status = 'paid') from public.orders where id in (tests.id('o1'), tests.id('o3'))));

-- Migração 1500: só se reembolsa um pagamento já pago.
select tests.login('ownerA'); set role authenticated;
select tests.ok('não se reembolsa um pagamento pendente',
  tests.error_hint(format('update public.orders set payment_status = %L where id = %L', 'refunded', tests.id('o2'))) = 'refund_before_paid'
  and (select payment_status from public.orders where id = tests.id('o2')) = 'pending');
select tests.ok('reembolsar em Pagamentos um pagamento ainda não pago também é recusado',
  tests.error_hint(format('insert into public.payments (restaurant_id, order_id, amount, method, status, transaction_reference) values (%L, %L, 1000, %L, %L, %L)',
    tests.id('restA1'), tests.id('o2'), 'cash', 'refunded', '')) = 'refund_before_paid');
update public.orders set payment_status = 'refunded' where id = tests.id('o1');
reset role;
select tests.ok('depois de pago, o pagamento pode ser reembolsado',
  (select payment_status from public.orders where id = tests.id('o1')) = 'refunded');
select tests.ok('pagamento confirmado chega à sessão',
  tests.msgs('tokAna', 'payment.confirmed') >= 1 and tests.msgs('tokCarla', 'payment.confirmed') = 0);
select tests.ok('vários pedidos pagos partilham o mesmo eventId (o telemóvel mostra um só aviso)',
  (select count(distinct payload ->> 'eventId') = 1 from realtime.messages
   where event = 'payment.confirmed' and topic = 'customer:' || tests.id('tokAna')));

-- ---------------------------------------------------------------------
-- 3. Pedido de atendimento e fim da sessão
-- ---------------------------------------------------------------------
select tests.login(null);
select tests.put('sr1', (public.create_service_request(tests.id('tA101'), 'water', tests.id('s1'), tests.id('tokAna')) ->> 'id')::uuid);
select tests.login('ownerA'); set role authenticated;
update public.service_requests set status = 'in_progress' where id = tests.id('sr1');
select public.close_table_session(tests.id('s1'), true, 'Teste: fecho com valores em aberto');
reset role;
select tests.ok('atendimento em curso notifica a sessão',
  tests.msgs('tokBruno', 'service_request.status_changed') = 1
  and (select payload ->> 'requestType' from realtime.messages
       where event = 'service_request.status_changed' and topic = 'customer:' || tests.id('tokBruno')) = 'water');
select tests.ok('sessão encerrada notifica todos os telemóveis da sessão',
  tests.msgs('tokAna', 'session.closed') = 1 and tests.msgs('tokBruno', 'session.closed') = 1
  and tests.msgs('tokCarla', 'session.closed') = 0);

-- ---------------------------------------------------------------------
-- 4. RLS: quem pode abrir cada canal
-- ---------------------------------------------------------------------
select tests.ok('cliente lê as mensagens do SEU canal',
  tests.anon_can_read('customer:' || tests.id('tokAna')::text) = tests.msgs('tokAna'));
select tests.ok('no canal da Carla não aparecem mensagens da Ana',
  tests.anon_can_read('customer:' || tests.id('tokCarla')::text) = tests.msgs('tokCarla'));
select tests.ok('token inventado não abre nenhum canal',
  tests.anon_can_read('customer:' || gen_random_uuid()::text) = 0);
select tests.ok('canal de outro formato (ex.: id da sessão) é recusado',
  tests.anon_can_read('customer:' || tests.id('s1')::text) = 0
  and tests.anon_can_read('session:' || tests.id('s1')::text) = 0
  and tests.anon_can_read(null) = 0);
update public.table_sessions set closed_at = now() - interval '13 hours' where id = tests.id('s1');
select tests.ok('canal de uma sessão encerrada há mais de 12 h deixa de abrir',
  tests.anon_can_read('customer:' || tests.id('tokAna')::text) = 0);

select tests.ok('cliente não pode enviar mensagens para os canais (sem política de INSERT)',
  not exists (select 1 from pg_policies where schemaname = 'realtime' and tablename = 'messages' and cmd in ('INSERT', 'ALL')));

-- ---------------------------------------------------------------------
-- 5. Uma falha do Realtime nunca impede a operação
-- ---------------------------------------------------------------------
alter function realtime.send(jsonb, text, text, boolean) rename to send_ok;
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language plpgsql as $$ begin raise exception 'Realtime indisponível'; end $$;
select tests.login('ownerA'); set role authenticated;
select public.update_order_status(tests.id('o2'), 'received');
reset role;
select tests.ok('com o Realtime em falha, o estado do pedido muda na mesma',
  (select status from public.orders where id = tests.id('o2')) = 'received');
drop function realtime.send(jsonb, text, text, boolean);
alter function realtime.send_ok(jsonb, text, text, boolean) rename to send;

-- ---------------------------------------------------------------------
-- 6. Web Push (migração 1700): ecrã bloqueado / página fechada
-- ---------------------------------------------------------------------
-- Substitutos do Vault e do pg_net (não existem no PostgreSQL de testes).
create schema if not exists vault;
create table if not exists vault.decrypted_secrets (name text, decrypted_secret text);
create schema if not exists net;
create table tests.http (url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
                              headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language sql as $$ insert into tests.http values (url, body, headers); select 1::bigint $$;

select tests.login(null);
select public.register_push_subscription(tests.id('s2'), tests.id('tokCarla'),
  'https://fcm.googleapis.com/fcm/send/abc123', 'BOr1p256dhKeyBase64Url_abcdefghijklmnop', 'authSecret123', 'https://app.test/m/a/mesa-02');
select tests.ok('cliente regista a subscrição push do seu telemóvel',
  (select count(*) = 1 and bool_and(page_url = 'https://app.test/m/a/mesa-02') from public.push_subscriptions where session_id = tests.id('s2')));
select public.register_push_subscription(tests.id('s2'), tests.id('tokCarla'),
  'https://fcm.googleapis.com/fcm/send/abc123', 'BOr1p256dhKeyBase64Url_abcdefghijklmnop', 'authSecret456');
select tests.ok('registar de novo o mesmo telemóvel não duplica',
  (select count(*) = 1 from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/abc123'));
select tests.ok('token de outra sessão não regista push nesta sessão',
  tests.error_hint(format($q$select public.register_push_subscription(%L, %L, 'https://x.test/e1', 'BOr1p256dhKeyBase64Url_abcdefghijklmnop', 'authSecret123')$q$,
    tests.id('s2'), tests.id('tokDino'))) = 'invalid_session');
select tests.ok('sessão encerrada não aceita subscrições',
  tests.error_hint(format($q$select public.register_push_subscription(%L, %L, 'https://x.test/e2', 'BOr1p256dhKeyBase64Url_abcdefghijklmnop', 'authSecret123')$q$,
    tests.id('s1'), tests.id('tokAna'))) = 'invalid_session');
select tests.ok('clientes não leem as subscrições (endpoints) de ninguém',
  tests.error_hint('set local role anon; select count(*) from public.push_subscriptions') = '42501');

-- Sem segredos no Vault: push desligado, o resto funciona.
select tests.login('ownerA'); set role authenticated;
select public.update_order_status(tests.id('o2'), 'preparing');
reset role;
select tests.ok('sem configuração, nenhum push é pedido (e o estado muda na mesma)',
  (select count(*) = 0 from tests.http) and (select status from public.orders where id = tests.id('o2')) = 'preparing');

insert into vault.decrypted_secrets values
  ('tapmenu_push_url', 'https://ref.supabase.co/functions/v1/send-customer-push'),
  ('tapmenu_push_secret', 'segredo-de-teste');
select tests.login('ownerA'); set role authenticated;
select public.update_order_status(tests.id('o2'), 'ready');
select public.update_order_status(tests.id('oVat'), 'preparing');
reset role;
select tests.ok('estado alterado → push pedido à Edge Function para a sessão, com o segredo',
  (select count(*) = 1 from tests.http)
  and (select bool_and(url = 'https://ref.supabase.co/functions/v1/send-customer-push'
                       and body ->> 'sessionId' = tests.id('s2')::text
                       and body -> 'event' ->> 'status' = 'ready'
                       and headers ->> 'x-tapmenu-push-secret' = 'segredo-de-teste') from tests.http));
select tests.ok('sessão sem telemóveis subscritos não gera pedidos de push',
  not exists (select 1 from tests.http where body ->> 'sessionId' = tests.id('s3')::text));

select tests.login(null);
select public.unregister_push_subscription(tests.id('tokDino'), 'https://fcm.googleapis.com/fcm/send/abc123');
select tests.ok('outro cliente não remove a subscrição alheia',
  exists (select 1 from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/abc123'));
select tests.login('ownerA'); set role authenticated;
select public.close_table_session(tests.id('s2'), true, 'Teste: fecho com valores em aberto');
reset role;
select tests.ok('fim da sessão apaga as subscrições push (e não envia push)',
  not exists (select 1 from public.push_subscriptions where session_id = tests.id('s2'))
  and (select count(*) = 1 from tests.http));

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
