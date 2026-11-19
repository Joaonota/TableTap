-- =====================================================================
-- TapMenu — 1600 · Preços com IVA incluído
--
-- Nos estabelecimentos, o preço do produto JÁ inclui o IVA (um refresco a
-- 150 MT custa 150 MT). Até aqui o IVA era somado por cima do preço.
--
-- A partir de agora (pedidos novos):
--   total      = soma dos preços dos produtos + taxa de serviço (se houver)
--   tax_amount = IVA incluído no preço = subtotal × taxa ÷ (100 + taxa)
--                (informativo, para recibos e relatórios)
--
-- Os pedidos já existentes não são alterados.
-- Única alteração na função: as três linhas do cálculo do IVA/total.
-- =====================================================================

create or replace function public.place_order(
  p_session_id uuid,
  p_participant_token uuid,
  p_items jsonb,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_notes text default null,
  p_payment_method text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
  v_participant public.session_participants;
  v_restaurant public.restaurants;
  v_table public.dining_tables;
  v_item jsonb;
  v_product public.products;
  v_variant public.product_variants;
  v_addons jsonb;
  v_addon_total numeric;
  v_unit numeric;
  v_qty integer;
  v_subtotal numeric := 0;
  v_tax numeric;
  v_fee numeric;
  v_number integer;
  v_order_id uuid;
  v_is_additional boolean;
  v_position integer := 0;
  v_customer text;
  v_item_count integer;
  v_is_staff boolean;
begin
  select * into v_session from public.table_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Sessão não encontrada.' using hint = 'session_not_found';
  end if;
  if v_session.status <> 'active' then
    raise exception 'A sessão desta mesa já foi encerrada. Atualize a página para iniciar uma nova.' using hint = 'session_not_active';
  end if;
  v_participant := private.assert_session_actor(v_session, p_participant_token);
  v_is_staff := v_participant.id is null;

  select * into v_restaurant from public.restaurants where id = v_session.restaurant_id;
  select * into v_table from public.dining_tables where id = v_session.table_id;
  if not v_is_staff and coalesce((v_restaurant.settings ->> 'allowCustomerOrdering')::boolean, true) = false then
    raise exception 'Este restaurante não aceita pedidos pelo menu digital.' using hint = 'ordering_disabled';
  end if;
  if p_payment_method is not null and p_payment_method not in ('mpesa', 'emola', 'card', 'cash') then
    raise exception 'Método de pagamento inválido.' using hint = 'invalid_payment_method';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O pedido não tem itens.' using hint = 'order_empty';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Demasiados itens num só pedido.' using hint = 'order_too_large';
  end if;

  update public.restaurant_counters set last_order_number = last_order_number + 1
  where restaurant_id = v_restaurant.id returning last_order_number into v_number;
  if v_number is null then
    insert into public.restaurant_counters (restaurant_id, last_order_number) values (v_restaurant.id, 1001)
    on conflict (restaurant_id) do update set last_order_number = public.restaurant_counters.last_order_number + 1
    returning last_order_number into v_number;
  end if;

  v_is_additional := exists (select 1 from public.orders where table_session_id = v_session.id);
  v_customer := coalesce(nullif(trim(coalesce(p_customer_name, '')), ''), v_participant.name, v_session.primary_customer_name, 'Cliente');

  insert into public.orders (restaurant_id, table_id, table_number, table_session_id, participant_id, is_additional,
                             order_number, order_code, type, payment_method, customer_name, customer_phone, notes)
  values (v_restaurant.id, v_table.id, v_table.number, v_session.id, v_participant.id, v_is_additional,
          v_number, '#ORD-' || v_number, 'dine_in', p_payment_method, left(v_customer, 60),
          nullif(trim(coalesce(p_customer_phone, '')), ''), nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 99 then
      raise exception 'Quantidade inválida.' using hint = 'invalid_quantity';
    end if;
    select * into v_product from public.products
    where id = private.try_uuid(v_item ->> 'productId') and restaurant_id = v_restaurant.id;
    if not found or not v_product.is_active then
      raise exception 'Um dos produtos já não existe no menu. Atualize a página.' using hint = 'product_not_found';
    end if;
    if not v_product.is_available then
      raise exception '%', format('%s não está disponível no momento.', v_product.name) using hint = 'product_unavailable';
    end if;

    v_variant := null;
    if coalesce(v_item ->> 'variantId', '') <> '' then
      select * into v_variant from public.product_variants
      where id = private.try_uuid(v_item ->> 'variantId') and product_id = v_product.id;
      if not found then
        raise exception '%', format('A opção escolhida para %s já não existe. Atualize a página.', v_product.name) using hint = 'variant_not_found';
      end if;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'price', a.price) order by a.sort_order), '[]'::jsonb),
           coalesce(sum(a.price), 0), count(*)
    into v_addons, v_addon_total, v_item_count
    from public.product_addons a
    where a.product_id = v_product.id
      and a.id in (select private.try_uuid(x) from jsonb_array_elements_text(coalesce(v_item -> 'addonIds', '[]'::jsonb)) x);
    if v_item_count <> jsonb_array_length(coalesce(v_item -> 'addonIds', '[]'::jsonb)) then
      raise exception '%', format('Um dos adicionais de %s já não existe. Atualize a página.', v_product.name) using hint = 'addon_not_found';
    end if;

    v_unit := coalesce(v_product.promotional_price, v_product.price) + coalesce(v_variant.price_delta, 0) + v_addon_total;
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_position := v_position + 1;

    insert into public.order_items (order_id, restaurant_id, product_id, product_name, product_image, quantity, unit_price,
                                    total_price, selected_variant, selected_addons, removed_ingredients, notes, station, sort_order)
    values (v_order_id, v_restaurant.id, v_product.id, v_product.name, nullif(v_product.image_url, ''), v_qty, v_unit,
            v_unit * v_qty,
            case when v_variant.id is null then null
                 else jsonb_build_object('id', v_variant.id, 'name', v_variant.name, 'priceDelta', v_variant.price_delta) end,
            v_addons,
            coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_item -> 'removedIngredients', '[]'::jsonb)) x
                      where x = any (v_product.removable_ingredients)), '{}'),
            nullif(left(trim(coalesce(v_item ->> 'notes', '')), 300), ''),
            v_product.station, v_position);
  end loop;

  -- Preços com IVA incluído: o IVA é a parte do preço, não um acréscimo.
  v_tax := round(v_subtotal * v_restaurant.tax_rate / (100 + v_restaurant.tax_rate), 2);
  v_fee := round(v_subtotal * coalesce((v_restaurant.settings ->> 'serviceFeePercent')::numeric, 0) / 100, 2);
  update public.orders
  set subtotal = round(v_subtotal, 2), tax_amount = v_tax, service_fee = v_fee, total = round(v_subtotal, 2) + v_fee
  where id = v_order_id;

  insert into public.order_status_history (order_id, restaurant_id, status, updated_by)
  values (v_order_id, v_restaurant.id, 'received', case when v_is_staff then private.actor_name() else v_customer end);

  perform private.recalculate_session_total(v_session.id);

  perform private.notify(v_restaurant.id,
    case when v_is_additional then 'additional_order' else 'new_order' end,
    case when v_is_additional then 'Pedido adicional recebido' else 'Novo pedido recebido' end,
    format('%s #ORD-%s — Mesa %s (%s) — %s %s — Total: %s',
           case when v_is_additional then 'Pedido adicional' else 'Pedido' end, v_number, v_table.number, v_customer,
           v_position, case when v_position = 1 then 'item' else 'itens' end,
           private.money(round(v_subtotal, 2) + v_fee)),
    v_table.id, v_table.number, v_session.id, v_order_id);

  return private.order_json(v_order_id);
end;
$$;

