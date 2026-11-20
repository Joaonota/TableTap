-- =====================================================================
-- TapMenu — 1900 · Empresa com vários estabelecimentos
--
-- Para o PROPRIETÁRIO (company_owner, ou Super Admin):
--   get_company_overview      faturação, pedidos e produtos por localização
--                             + totais consolidados e período anterior
--   copy_menu_to_restaurants  distribuir categorias e produtos (com
--                             variantes e adicionais) para outras localizações
--   apply_company_promotion   campanha de preço em vários estabelecimentos
--   end_company_promotion
--   get_company_alerts        situações incomuns (ver regras abaixo)
--
-- Tudo calculado no servidor a partir dos registos reais (pedidos,
-- histórico de estados, pagamentos, sessões). Empresas isoladas: cada
-- função valida o acesso do utilizador à empresa.
--
-- Regras dos alertas (período escolhido):
--   cancellations_by_staff      ≥ 3 pedidos cancelados pela mesma pessoa e
--                               ≥ 5% dos pedidos do estabelecimento
--   cancelled_after_preparation ≥ 2 pedidos cancelados depois de "Em preparação"/"Pronto"
--   frequent_refunds            ≥ 3 reembolsos, ou ≥ 5% dos pagamentos pagos
--   payment_mismatch            pedidos "Pago" cujo valor recebido difere do total (> 1 MT)
--   delivered_unpaid            pedidos entregues, de mesas já encerradas, sem pagamento
--   forced_close                mesas encerradas com valores por pagar (fecho forçado)
-- Não há ainda descontos manuais no TapMenu: quando existirem, entram aqui.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Quem mudou o estado de um pagamento (para os alertas de reembolso)
-- ---------------------------------------------------------------------
alter table public.payments
  add column if not exists status_changed_by text,
  add column if not exists status_changed_at timestamptz;

create or replace function private.stamp_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_by := private.actor_name();
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists stamp_payment_status on public.payments;
create trigger stamp_payment_status before insert or update of status on public.payments
  for each row execute function private.stamp_payment_status();

/** Só o proprietário da empresa (ou o Super Admin). */
create or replace function private.assert_company_owner(p_company_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_company_id is null or not private.has_company_access(p_company_id, 50) then
    raise exception 'Só o proprietário da empresa tem acesso a esta área.' using errcode = '42501', hint = 'forbidden';
  end if;
end;
$$;

create or replace function private.assert_period(p_from timestamptz, p_to timestamptz)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'Período inválido (máximo 400 dias).' using hint = 'invalid_period';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Visão consolidada e comparação entre localizações
-- ---------------------------------------------------------------------
create or replace function public.get_company_overview(p_company_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prev_from timestamptz := p_from - (p_to - p_from);
  v_result jsonb;
begin
  perform private.assert_company_owner(p_company_id);
  perform private.assert_period(p_from, p_to);

  -- Faturação = pedidos não cancelados nem reembolsados (o dinheiro devolvido não conta).
  with per_rest as (
    select r.id, r.name, r.is_active,
      coalesce(sum(o.total) filter (where o.status <> 'cancelled' and o.payment_status <> 'refunded' and o.created_at >= p_from), 0) as revenue,
      count(o.id) filter (where o.status <> 'cancelled' and o.payment_status <> 'refunded' and o.created_at >= p_from) as orders,
      count(o.id) filter (where o.status = 'cancelled' and o.created_at >= p_from) as cancelled,
      coalesce(sum(o.total) filter (where o.payment_status in ('paid', 'confirmed') and o.created_at >= p_from), 0) as paid,
      count(o.id) filter (where o.payment_status = 'refunded' and o.created_at >= p_from) as refunds,
      coalesce(sum(o.total) filter (where o.status <> 'cancelled' and o.payment_status <> 'refunded' and o.created_at < p_from), 0) as prev_revenue,
      count(o.id) filter (where o.status <> 'cancelled' and o.payment_status <> 'refunded' and o.created_at < p_from) as prev_orders
    from public.restaurants r
    left join public.orders o on o.restaurant_id = r.id and o.created_at >= v_prev_from and o.created_at < p_to
    where r.company_id = p_company_id
    group by r.id, r.name, r.is_active
  ),
  items as (
    select lower(trim(i.product_name)) as product_key, min(i.product_name) as product_name, o.restaurant_id,
           sum(i.quantity) as quantity, sum(i.total_price) as revenue
    from public.order_items i
    join public.orders o on o.id = i.order_id
    where o.company_id = p_company_id and o.status <> 'cancelled' and o.payment_status <> 'refunded'
      and o.created_at >= p_from and o.created_at < p_to
    group by 1, o.restaurant_id
  ),
  products as (
    select product_key, min(product_name) as product_name, sum(quantity) as quantity, sum(revenue) as revenue,
           jsonb_agg(jsonb_build_object('restaurantId', restaurant_id, 'quantity', quantity, 'revenue', revenue)
                     order by revenue desc) as by_restaurant
    from items group by product_key
    order by sum(revenue) desc
    limit 20
  ),
  daily as (
    select (o.created_at at time zone 'Africa/Maputo')::date as day, o.restaurant_id, sum(o.total) as revenue
    from public.orders o
    where o.company_id = p_company_id and o.status <> 'cancelled' and o.payment_status <> 'refunded'
      and o.created_at >= p_from and o.created_at < p_to
    group by 1, 2
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'totals', (select jsonb_build_object(
        'revenue', coalesce(sum(revenue), 0), 'orders', coalesce(sum(orders), 0), 'cancelled', coalesce(sum(cancelled), 0),
        'paid', coalesce(sum(paid), 0), 'refunds', coalesce(sum(refunds), 0),
        'prevRevenue', coalesce(sum(prev_revenue), 0), 'prevOrders', coalesce(sum(prev_orders), 0),
        'averageTicket', case when coalesce(sum(orders), 0) > 0 then round(sum(revenue) / sum(orders), 2) else 0 end)
      from per_rest),
    'restaurants', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'isActive', is_active, 'revenue', revenue, 'orders', orders, 'cancelled', cancelled,
        'paid', paid, 'refunds', refunds, 'prevRevenue', prev_revenue, 'prevOrders', prev_orders,
        'averageTicket', case when orders > 0 then round(revenue / orders, 2) else 0 end,
        'cancellationRate', case when orders + cancelled > 0 then round(cancelled::numeric * 100 / (orders + cancelled), 1) else 0 end)
        order by revenue desc, name) from per_rest), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object(
        'name', product_name, 'quantity', quantity, 'revenue', revenue, 'byRestaurant', by_restaurant)
        order by revenue desc) from products), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'restaurantId', restaurant_id, 'revenue', revenue)
        order by day) from daily), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Distribuir menu (categorias + produtos) para outras localizações
-- ---------------------------------------------------------------------
create or replace function public.copy_menu_to_restaurants(
  p_source_restaurant_id uuid,
  p_target_restaurant_ids uuid[],
  p_category_ids uuid[] default null,
  p_update_existing boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.restaurants;
  v_target public.restaurants;
  v_cat public.categories;
  v_target_cat uuid;
  v_prod public.products;
  v_existing uuid;
  v_new_prod uuid;
  v_cats_created integer;
  v_created integer;
  v_updated integer;
  v_skipped integer;
  v_report jsonb := '[]'::jsonb;
begin
  select * into v_source from public.restaurants where id = p_source_restaurant_id;
  if not found then
    raise exception 'Estabelecimento de origem não encontrado.' using hint = 'restaurant_not_found';
  end if;
  perform private.assert_company_owner(v_source.company_id);
  if p_target_restaurant_ids is null or cardinality(p_target_restaurant_ids) = 0 then
    raise exception 'Escolha pelo menos um estabelecimento de destino.' using hint = 'targets_required';
  end if;

  for v_target in
    select * from public.restaurants where id = any(p_target_restaurant_ids) and id <> v_source.id order by name
  loop
    if v_target.company_id <> v_source.company_id then
      raise exception 'Só pode copiar para estabelecimentos da mesma empresa.' using errcode = '42501', hint = 'forbidden';
    end if;
    v_cats_created := 0; v_created := 0; v_updated := 0; v_skipped := 0;

    for v_cat in
      select * from public.categories
      where restaurant_id = v_source.id and (p_category_ids is null or id = any(p_category_ids))
      order by sort_order, name
    loop
      select id into v_target_cat from public.categories
      where restaurant_id = v_target.id and lower(trim(name)) = lower(trim(v_cat.name)) limit 1;
      if v_target_cat is null then
        insert into public.categories (restaurant_id, name, description, image_url, sort_order, is_active)
        values (v_target.id, v_cat.name, v_cat.description, v_cat.image_url, v_cat.sort_order, v_cat.is_active)
        returning id into v_target_cat;
        v_cats_created := v_cats_created + 1;
      end if;

      for v_prod in select * from public.products where category_id = v_cat.id order by sort_order, name loop
        select id into v_existing from public.products
        where restaurant_id = v_target.id and lower(trim(name)) = lower(trim(v_prod.name)) limit 1;
        if v_existing is not null then
          if p_update_existing then
            update public.products
            set price = v_prod.price, promotional_price = v_prod.promotional_price, is_promotion = v_prod.is_promotion,
                description = v_prod.description, image_url = v_prod.image_url
            where id = v_existing;
            v_updated := v_updated + 1;
          else
            v_skipped := v_skipped + 1;
          end if;
          continue;
        end if;

        insert into public.products (restaurant_id, category_id, name, description, image_url, price, promotional_price,
          is_available, is_featured, preparation_time_minutes, station, removable_ingredients, allergens, sort_order,
          is_active, is_promotion, is_spicy, is_vegetarian)
        values (v_target.id, v_target_cat, v_prod.name, v_prod.description, v_prod.image_url, v_prod.price, v_prod.promotional_price,
          v_prod.is_available, v_prod.is_featured, v_prod.preparation_time_minutes, v_prod.station, v_prod.removable_ingredients,
          v_prod.allergens, v_prod.sort_order, v_prod.is_active, v_prod.is_promotion, v_prod.is_spicy, v_prod.is_vegetarian)
        returning id into v_new_prod;
        insert into public.product_variants (product_id, restaurant_id, name, price_delta, sort_order)
        select v_new_prod, v_target.id, name, price_delta, sort_order from public.product_variants where product_id = v_prod.id;
        insert into public.product_addons (product_id, restaurant_id, name, price, is_default, sort_order)
        select v_new_prod, v_target.id, name, price, is_default, sort_order from public.product_addons where product_id = v_prod.id;
        v_created := v_created + 1;
      end loop;
    end loop;

    v_report := v_report || jsonb_build_object('restaurantId', v_target.id, 'name', v_target.name,
      'categoriesCreated', v_cats_created, 'productsCreated', v_created, 'productsUpdated', v_updated, 'productsSkipped', v_skipped);
  end loop;

  insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
  values (v_source.company_id, (select auth.uid()), private.actor_name(), 'menu.distributed', 'Menu de ' || v_source.name,
          format('Copiado para %s estabelecimento(s).', jsonb_array_length(v_report)));
  return jsonb_build_object('targets', v_report);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Campanha de preço em vários estabelecimentos
-- ---------------------------------------------------------------------
create or replace function public.apply_company_promotion(
  p_company_id uuid,
  p_product_names text[],
  p_discount_percent numeric,
  p_restaurant_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.assert_company_owner(p_company_id);
  if p_discount_percent is null or p_discount_percent <= 0 or p_discount_percent >= 100 then
    raise exception 'O desconto deve estar entre 1%% e 99%%.' using hint = 'invalid_discount';
  end if;
  if p_product_names is null or cardinality(p_product_names) = 0 then
    raise exception 'Escolha os produtos da campanha.' using hint = 'products_required';
  end if;
  update public.products p
  set promotional_price = round(p.price * (100 - p_discount_percent) / 100, 2), is_promotion = true
  where p.company_id = p_company_id
    and lower(trim(p.name)) in (select lower(trim(n)) from unnest(p_product_names) n)
    and (p_restaurant_ids is null or p.restaurant_id = any(p_restaurant_ids));
  get diagnostics v_count = row_count;
  insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
  values (p_company_id, (select auth.uid()), private.actor_name(), 'promotion.applied', 'Campanha de preço',
          format('%s%% em %s produto(s): %s', p_discount_percent, v_count, left(array_to_string(p_product_names, ', '), 300)));
  return jsonb_build_object('updated', v_count);
end;
$$;

create or replace function public.end_company_promotion(
  p_company_id uuid,
  p_product_names text[],
  p_restaurant_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.assert_company_owner(p_company_id);
  update public.products p
  set promotional_price = null, is_promotion = false
  where p.company_id = p_company_id
    and (p.is_promotion or p.promotional_price is not null)
    and lower(trim(p.name)) in (select lower(trim(n)) from unnest(coalesce(p_product_names, '{}')) n)
    and (p_restaurant_ids is null or p.restaurant_id = any(p_restaurant_ids));
  get diagnostics v_count = row_count;
  insert into public.audit_logs (company_id, user_id, user_name, action, resource, details)
  values (p_company_id, (select auth.uid()), private.actor_name(), 'promotion.ended', 'Campanha de preço',
          format('Terminada em %s produto(s).', v_count));
  return jsonb_build_object('updated', v_count);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Situações incomuns
-- ---------------------------------------------------------------------
create or replace function public.get_company_alerts(p_company_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_alerts jsonb := '[]'::jsonb;
begin
  perform private.assert_company_owner(p_company_id);
  perform private.assert_period(p_from, p_to);

  -- Cancelamentos concentrados na mesma pessoa.
  with orders_per_rest as (
    select restaurant_id, count(*) as n from public.orders
    where company_id = p_company_id and created_at >= p_from and created_at < p_to
    group by restaurant_id
  ),
  c as (
    select o.restaurant_id, h.updated_by as actor, count(distinct o.id) as n, sum(o.total) as amount
    from public.order_status_history h
    join public.orders o on o.id = h.order_id
    where o.company_id = p_company_id and h.status = 'cancelled' and h.created_at >= p_from and h.created_at < p_to
    group by o.restaurant_id, h.updated_by
  )
  select v_alerts || coalesce(jsonb_agg(jsonb_build_object(
      'kind', 'cancellations_by_staff',
      'severity', case when c.n >= 10 or c.n::numeric / greatest(r.n, 1) >= 0.15 then 'high' else 'medium' end,
      'restaurantId', c.restaurant_id, 'actor', c.actor, 'count', c.n, 'amount', c.amount,
      'rate', round(c.n::numeric * 100 / greatest(r.n, 1), 1))), '[]'::jsonb)
  into v_alerts
  from c join orders_per_rest r on r.restaurant_id = c.restaurant_id
  where c.n >= 3 and c.n::numeric / greatest(r.n, 1) >= 0.05;

  -- Cancelados depois de a cozinha começar (produto preparado e não servido).
  with x as (
    select o.restaurant_id, h.updated_by as actor, count(distinct o.id) as n, sum(o.total) as amount
    from public.order_status_history h
    join public.orders o on o.id = h.order_id
    where o.company_id = p_company_id and h.status = 'cancelled' and h.created_at >= p_from and h.created_at < p_to
      and exists (select 1 from public.order_status_history h2
                  where h2.order_id = o.id and h2.status in ('preparing', 'ready') and h2.created_at <= h.created_at)
    group by o.restaurant_id, h.updated_by
  )
  select v_alerts || coalesce(jsonb_agg(jsonb_build_object(
      'kind', 'cancelled_after_preparation', 'severity', case when n >= 5 then 'high' else 'medium' end,
      'restaurantId', restaurant_id, 'actor', actor, 'count', n, 'amount', amount)), '[]'::jsonb)
  into v_alerts
  from x where n >= 2;

  -- Reembolsos frequentes.
  with paid as (
    select p.restaurant_id,
           count(*) filter (where p.status in ('paid', 'confirmed', 'refunded')) as paid_n,
           count(*) filter (where p.status = 'refunded') as refund_n,
           coalesce(sum(p.amount) filter (where p.status = 'refunded'), 0) as refund_amount,
           (select string_agg(distinct p2.status_changed_by, ', ') from public.payments p2
            where p2.restaurant_id = p.restaurant_id and p2.status = 'refunded'
              and coalesce(p2.status_changed_at, p2.updated_at) >= p_from and coalesce(p2.status_changed_at, p2.updated_at) < p_to) as actors
    from public.payments p
    where p.company_id = p_company_id
      and coalesce(p.status_changed_at, p.updated_at) >= p_from and coalesce(p.status_changed_at, p.updated_at) < p_to
    group by p.restaurant_id
  )
  select v_alerts || coalesce(jsonb_agg(jsonb_build_object(
      'kind', 'frequent_refunds', 'severity', case when refund_n >= 6 then 'high' else 'medium' end,
      'restaurantId', restaurant_id, 'actor', actors, 'count', refund_n, 'amount', refund_amount,
      'rate', round(refund_n::numeric * 100 / greatest(paid_n, 1), 1))), '[]'::jsonb)
  into v_alerts
  from paid where refund_n >= 3 or (refund_n >= 1 and refund_n::numeric / greatest(paid_n, 1) >= 0.05 and paid_n >= 10);

  -- Pedidos "Pago" cujo valor recebido não bate com o total.
  with recv as (
    select o.id, o.restaurant_id, o.total,
           coalesce((select sum(p.amount) from public.payments p where p.order_id = o.id and p.status in ('paid', 'confirmed')), 0)
           + coalesce((select sum(a.amount) from public.payment_allocations a join public.payments p on p.id = a.payment_id
                       where a.order_id = o.id and p.status in ('paid', 'confirmed')), 0) as received
    from public.orders o
    where o.company_id = p_company_id and o.payment_status in ('paid', 'confirmed') and o.status <> 'cancelled'
      and o.created_at >= p_from and o.created_at < p_to
  )
  select v_alerts || coalesce(jsonb_agg(jsonb_build_object(
      'kind', 'payment_mismatch', 'severity', case when sum_diff >= 1000 then 'high' else 'medium' end,
      'restaurantId', restaurant_id, 'count', n, 'amount', sum_diff, 'orderCodes', codes)), '[]'::jsonb)
  into v_alerts
  from (select r.restaurant_id, count(*) as n, round(sum(abs(r.total - r.received)), 2) as sum_diff,
               (select jsonb_agg(o2.order_code) from (select o3.order_code from public.orders o3
                 where o3.id in (select id from recv r2 where r2.restaurant_id = r.restaurant_id and abs(r2.total - r2.received) > 1)
                 limit 10) o2) as codes
        from recv r where abs(r.total - r.received) > 1 group by r.restaurant_id) m;

  -- Entregues em mesas já encerradas, sem pagamento.
  select v_alerts || coalesce(jsonb_agg(jsonb_build_object(
      'kind', 'delivered_unpaid', 'severity', case when amount >= 1000 then 'high' else 'medium' end,
      'restaurantId', restaurant_id, 'count', n, 'amount', amount)), '[]'::jsonb)
  into v_alerts
  from (select o.restaurant_id, count(*) as n, sum(o.total) as amount
        from public.orders o
        join public.table_sessions s on s.id = o.table_session_id
        where o.company_id = p_company_id and o.status = 'delivered' and o.payment_status in ('pending', 'failed')
          and s.status = 'closed' and o.created_at >= p_from and o.created_at < p_to
          and not exists (select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id
                          where a.order_id = o.id and p.status in ('paid', 'confirmed'))
        group by o.restaurant_id) d;

  -- Mesas encerradas à força com valores por pagar.
  select v_alerts || coalesce(jsonb_agg(jsonb_build_object(
      'kind', 'forced_close', 'severity', case when amount >= 1000 or n >= 3 then 'high' else 'medium' end,
      'restaurantId', restaurant_id, 'actor', actors, 'count', n, 'amount', amount)), '[]'::jsonb)
  into v_alerts
  from (select restaurant_id, count(*) as n, sum(unpaid_at_close) as amount, string_agg(distinct closed_by, ', ') as actors
        from public.table_sessions
        where company_id = p_company_id and unpaid_at_close > 0 and closed_at >= p_from and closed_at < p_to
        group by restaurant_id) f;

  -- Nome do estabelecimento e ordenação (graves primeiro).
  return coalesce((
    select jsonb_agg(a || jsonb_build_object('restaurantName', r.name)
                     order by (a ->> 'severity') = 'high' desc, (a ->> 'amount')::numeric desc nulls last)
    from jsonb_array_elements(v_alerts) a
    left join public.restaurants r on r.id = (a ->> 'restaurantId')::uuid), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Privilégios
-- ---------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on function private.can_receive_customer_topic(text) to anon;

revoke execute on function
  public.get_company_overview(uuid, timestamptz, timestamptz),
  public.copy_menu_to_restaurants(uuid, uuid[], uuid[], boolean),
  public.apply_company_promotion(uuid, text[], numeric, uuid[]),
  public.end_company_promotion(uuid, text[], uuid[]),
  public.get_company_alerts(uuid, timestamptz, timestamptz)
from public, anon;
grant execute on function
  public.get_company_overview(uuid, timestamptz, timestamptz),
  public.copy_menu_to_restaurants(uuid, uuid[], uuid[], boolean),
  public.apply_company_promotion(uuid, text[], numeric, uuid[]),
  public.end_company_promotion(uuid, text[], uuid[]),
  public.get_company_alerts(uuid, timestamptz, timestamptz)
to authenticated;
