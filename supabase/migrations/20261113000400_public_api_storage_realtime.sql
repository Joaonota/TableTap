-- =====================================================================
-- TapMenu — 0400 · API pública do menu, Storage e Realtime
--
-- O cliente que abre a URL da mesa (etiqueta NFC ou QR Code) não tem
-- conta: lê apenas o necessário através destas funções. As tabelas não
-- têm políticas para `anon`.
-- =====================================================================

create or replace function private.restaurant_json(r public.restaurants)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id, 'tenantId', r.company_id, 'name', r.name, 'slug', r.slug, 'description', r.description,
    'coverImage', coalesce(r.cover_image_url, ''), 'logoUrl', coalesce(r.logo_url, ''), 'address', r.address,
    'phone', r.phone, 'email', r.email, 'currency', r.currency, 'timezone', r.timezone, 'openingHours', r.opening_hours,
    'isActive', r.is_active and coalesce((select c.is_active from public.companies c where c.id = r.company_id), false),
    'taxRate', r.tax_rate, 'settings', r.settings, 'createdAt', r.created_at)
$$;

create or replace function private.table_json(t public.dining_tables)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id, 'tenantId', t.company_id, 'restaurantId', t.restaurant_id, 'number', t.number, 'name', t.name,
    'slug', t.slug, 'area', t.area, 'capacity', t.capacity, 'status', t.status, 'activeSessionId', t.active_session_id,
    'isActive', t.is_active, 'createdAt', t.created_at, 'updatedAt', t.updated_at)
$$;

/**
 * Resolve a URL pública /m/{restaurante}/{mesa}: restaurante, mesa e sessão
 * ativa. `p_table_key` aceita o slug permanente ou, para URLs antigas, o número.
 */
create or replace function public.get_public_table(p_restaurant_slug text, p_table_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_restaurant public.restaurants;
  v_table public.dining_tables;
begin
  select * into v_restaurant from public.restaurants where slug = lower(p_restaurant_slug);
  if not found then
    return null;
  end if;
  select * into v_table from public.dining_tables where restaurant_id = v_restaurant.id and slug = lower(p_table_key);
  if not found then
    select * into v_table from public.dining_tables where restaurant_id = v_restaurant.id and lower(number) = lower(p_table_key);
  end if;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'restaurant', private.restaurant_json(v_restaurant),
    'table', private.table_json(v_table),
    'activeSession', case when v_table.active_session_id is null then null else private.session_json(v_table.active_session_id) end);
end;
$$;

/** Conteúdo do menu publicado: categorias e produtos ativos e a personalização visual. */
create or replace function public.get_public_menu(p_restaurant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'tenantId', c.company_id, 'restaurantId', c.restaurant_id, 'name', c.name, 'description', c.description,
        'imageUrl', c.image_url, 'sortOrder', c.sort_order, 'isActive', c.is_active) order by c.sort_order, c.name)
      from public.categories c where c.restaurant_id = r.id and c.is_active), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'tenantId', p.company_id, 'restaurantId', p.restaurant_id, 'categoryId', p.category_id,
        'categoryName', c.name, 'name', p.name, 'description', p.description, 'imageUrl', p.image_url,
        'price', p.price, 'promotionalPrice', p.promotional_price, 'isAvailable', p.is_available,
        'isFeatured', p.is_featured, 'preparationTimeMinutes', p.preparation_time_minutes, 'station', p.station,
        'removableIngredients', to_jsonb(p.removable_ingredients), 'allergens', to_jsonb(p.allergens),
        'sortOrder', p.sort_order, 'isActive', p.is_active, 'isPromotion', p.is_promotion, 'isSpicy', p.is_spicy,
        'isVegetarian', p.is_vegetarian,
        'variants', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'priceDelta', v.price_delta) order by v.sort_order)
                              from public.product_variants v where v.product_id = p.id), '[]'::jsonb),
        'addons', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'price', a.price, 'isDefault', a.is_default) order by a.sort_order)
                            from public.product_addons a where a.product_id = p.id), '[]'::jsonb)
      ) order by p.sort_order, p.name)
      from public.products p join public.categories c on c.id = p.category_id
      where p.restaurant_id = r.id and p.is_active and c.is_active), '[]'::jsonb),
    'customization', (select m.theme from public.menu_customizations m where m.restaurant_id = r.id)
  )
  from public.restaurants r
  where r.id = p_restaurant_id
$$;

/** Pedidos da sessão (para o cliente acompanhar). Requer o token do participante. */
create or replace function public.get_session_orders(p_session_id uuid, p_participant_token uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
begin
  select * into v_session from public.table_sessions where id = p_session_id;
  if not found then
    raise exception 'Sessão não encontrada.' using hint = 'session_not_found';
  end if;
  perform private.assert_session_actor(v_session, p_participant_token);
  return coalesce((
    select jsonb_agg(private.order_json(o.id) order by o.created_at desc)
    from public.orders o where o.table_session_id = p_session_id), '[]'::jsonb);
end;
$$;

/** Acompanhamento de um pedido pelo link /pedido/{id} (o id é um UUID impossível de adivinhar). */
create or replace function public.get_public_order(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order', private.order_json(o.id),
    'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug, 'logoUrl', coalesce(r.logo_url, ''), 'phone', r.phone))
  from public.orders o join public.restaurants r on r.id = o.restaurant_id
  where o.id = p_order_id
$$;

-- =====================================================================
-- STORAGE — logótipos, imagens de produtos/categorias e capas.
-- Caminho obrigatório: {company_id}/{restaurant_id | "company"}/{tipo}/{ficheiro}
-- Leitura pública (as imagens aparecem no menu público); escrita só pela
-- equipa da empresa com papel de gerente ou superior.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_write_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.is_super_admin() then true
    when private.try_uuid((storage.foldername(p_name))[1]) is null then false
    when (storage.foldername(p_name))[2] = 'company'
      then private.has_company_access(private.try_uuid((storage.foldername(p_name))[1]), 50)
    else exists (
      select 1 from public.restaurants r
      where r.id = private.try_uuid((storage.foldername(p_name))[2])
        and r.company_id = private.try_uuid((storage.foldername(p_name))[1])
        and private.has_restaurant_access(r.id, 30))
  end
$$;
grant execute on function private.can_write_media(text) to authenticated;

create policy media_select on storage.objects for select to authenticated
  using (bucket_id = 'media' and private.can_write_media(name));
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and private.can_write_media(name));
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and private.can_write_media(name))
  with check (bucket_id = 'media' and private.can_write_media(name));
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and private.can_write_media(name));

-- =====================================================================
-- REALTIME — o painel, a cozinha e o atendimento recebem alterações ao
-- vivo. O Realtime respeita o RLS: cada utilizador só recebe o que pode ler.
-- =====================================================================
alter publication supabase_realtime add table
  public.orders, public.service_requests, public.notifications, public.dining_tables, public.table_sessions;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- =====================================================================
-- PRIVILÉGIOS DAS FUNÇÕES PÚBLICAS (explícitos — não depender dos defaults)
-- O cliente sem conta só pode usar as funções do menu da mesa; todas as
-- restantes exigem sessão (e validam o papel internamente).
-- =====================================================================
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function
  public.get_public_table(text, text),
  public.get_public_menu(uuid),
  public.get_session_orders(uuid, uuid),
  public.get_public_order(uuid),
  public.start_table_session(uuid, text, integer, text),
  public.join_table_session(uuid, text),
  public.place_order(uuid, uuid, jsonb, text, text, text, text),
  public.request_bill(uuid, uuid, text, text),
  public.create_service_request(uuid, text, uuid, uuid, text, text)
to anon;
