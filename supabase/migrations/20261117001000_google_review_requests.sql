-- =====================================================================
-- TapMenu — 1000 · Pedidos de avaliação no Google após a sessão da mesa
--
--   1. Cada ESTABELECIMENTO tem o seu próprio link oficial de avaliação
--      (restaurants.google_review_url), validado na base de dados.
--   2. Quando a sessão da mesa é ENCERRADA (status = 'closed'), o
--      telemóvel de cada participante mostra o ecrã de agradecimento com
--      o botão "Avaliar no Google". Nunca antes.
--   3. O TapMenu regista apenas o que consegue observar:
--        presented     → o ecrã de agradecimento foi apresentado;
--        google_opened → o cliente tocou em "Avaliar no Google";
--        forwarded     → o navegador saiu do TapMenu para o Google.
--      "Não solicitado" = sessão encerrada sem registo (sem link configurado
--      ou o cliente não voltou a ver o ecrã).
--      NUNCA se regista nem se afirma que o cliente publicou uma avaliação:
--      isso só será conhecido com a integração oficial do Google Business
--      Profile (coluna `provider` e tabela preparadas para isso).
--   4. Não se recolhe nenhum dado de login do cliente; do dispositivo só
--      se guarda a categoria (telemóvel / tablet / computador).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Link de avaliação por estabelecimento
-- ---------------------------------------------------------------------
alter table public.restaurants
  add column google_review_url text
  constraint restaurants_google_review_url_valid check (
    google_review_url is null or (
      length(google_review_url) <= 2048
      and google_review_url !~ '\s'
      and google_review_url ~* (
        '^https://('
        || 'g\.page/'                                    -- link curto do Perfil da Empresa
        || '|search\.google\.com/local/writereview\?'    -- formulário de avaliação (placeid)
        || '|(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?/(maps|search)' -- Google Maps / Pesquisa
        || '|maps\.google\.[a-z]{2,3}(\.[a-z]{2})?/'
        || '|maps\.app\.goo\.gl/'
        || '|goo\.gl/maps/'
        || '|g\.co/kgs/'
        || ')')
    )
  );

comment on column public.restaurants.google_review_url is
  'Link oficial de avaliação do estabelecimento no Google (Perfil da Empresa). Apresentado ao cliente após a sessão encerrada.';

-- O UPDATE em restaurants é concedido coluna a coluna (migrações 0200/0500);
-- quem pode editar o estabelecimento (RLS) pode alterar o link.
grant update (google_review_url) on public.restaurants to authenticated;

-- O link faz parte dos dados públicos do estabelecimento (menu da mesa).
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
    'taxRate', r.tax_rate, 'settings', r.settings, 'createdAt', r.created_at,
    'googleReviewUrl', coalesce(r.google_review_url, ''))
$$;

-- ---------------------------------------------------------------------
-- 2. Registo dos pedidos de avaliação
-- ---------------------------------------------------------------------
create table public.review_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_session_id uuid not null references public.table_sessions (id) on delete cascade,
  participant_id uuid not null references public.session_participants (id) on delete cascade,
  -- Preparado para outras plataformas / integração oficial no futuro.
  provider text not null default 'google' check (provider in ('google')),
  status text not null default 'presented' check (status in ('presented', 'google_opened', 'forwarded')),
  -- Link usado no momento (o estabelecimento pode alterá-lo depois).
  review_url text not null,
  device_type text check (device_type in ('mobile', 'tablet', 'desktop')),
  presented_at timestamptz not null default now(),
  opened_at timestamptz,
  forwarded_at timestamptz,
  created_at timestamptz not null default now(),
  -- Um pedido por participante (telemóvel) e sessão.
  unique (table_session_id, participant_id)
);
create index on public.review_requests (restaurant_id, presented_at desc);
create index on public.review_requests (company_id, presented_at desc);

create trigger set_company_from_restaurant before insert or update of restaurant_id, company_id on public.review_requests
  for each row execute function private.set_company_from_restaurant();

-- Só leitura para a equipa (gestor ou acima) do estabelecimento; escrita
-- apenas através das funções abaixo.
alter table public.review_requests enable row level security;
create policy review_requests_select on public.review_requests for select to authenticated
  using (private.has_restaurant_access(restaurant_id, 30));
revoke all on public.review_requests from anon;
revoke insert, update, delete on public.review_requests from authenticated;

-- ---------------------------------------------------------------------
-- 3. API do cliente (sem conta, autorizado pelo token do participante)
-- ---------------------------------------------------------------------

/**
 * Estado final da sessão para o ecrã de agradecimento do cliente.
 * Se a sessão estiver ENCERRADA e o estabelecimento tiver link de
 * avaliação, regista (uma vez por participante) que o pedido foi
 * apresentado e devolve-o. Sessões ativas ou canceladas não geram pedido.
 */
create or replace function public.get_session_closure(
  p_session_id uuid, p_participant_token uuid, p_device_type text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
  v_participant public.session_participants;
  v_restaurant public.restaurants;
  v_request public.review_requests;
  v_device text := case when p_device_type in ('mobile', 'tablet', 'desktop') then p_device_type end;
begin
  select * into v_session from public.table_sessions where id = p_session_id;
  if not found then
    raise exception 'Sessão não encontrada.' using hint = 'session_not_found';
  end if;
  select * into v_participant from public.session_participants
  where session_id = v_session.id and token = p_participant_token;
  if not found or p_participant_token is null then
    raise exception 'Junte-se à sessão desta mesa para continuar.' using errcode = '42501', hint = 'not_participant';
  end if;
  select * into v_restaurant from public.restaurants where id = v_session.restaurant_id;

  if v_session.status = 'closed' and v_restaurant.google_review_url is not null then
    insert into public.review_requests (restaurant_id, table_session_id, participant_id, review_url, device_type)
    values (v_session.restaurant_id, v_session.id, v_participant.id, v_restaurant.google_review_url, v_device)
    on conflict (table_session_id, participant_id)
      do update set device_type = coalesce(public.review_requests.device_type, excluded.device_type)
    returning * into v_request;
  end if;

  return jsonb_build_object(
    'sessionId', v_session.id,
    'status', v_session.status,
    'closedAt', v_session.closed_at,
    'restaurant', jsonb_build_object('id', v_restaurant.id, 'name', v_restaurant.name, 'logoUrl', coalesce(v_restaurant.logo_url, '')),
    'reviewRequest', case when v_request.id is null then null else jsonb_build_object(
      'id', v_request.id, 'provider', v_request.provider, 'url', v_request.review_url, 'status', v_request.status) end);
end;
$$;

/**
 * Regista o que o cliente fez no ecrã de agradecimento:
 *   google_opened → tocou em "Avaliar no Google";
 *   forwarded     → o navegador saiu do TapMenu para o Google.
 * O estado só avança (nunca recua). Não indica que a avaliação foi publicada.
 */
create or replace function public.track_review_request(p_request_id uuid, p_participant_token uuid, p_event text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  if p_event is null or p_event not in ('google_opened', 'forwarded') then
    raise exception 'Evento inválido.' using hint = 'invalid_event';
  end if;
  select r.id into v_id
  from public.review_requests r
  join public.session_participants p on p.id = r.participant_id
  where r.id = p_request_id and p.token = p_participant_token and p_participant_token is not null
  for update of r;
  if not found then
    raise exception 'Pedido de avaliação não encontrado.' using hint = 'not_found';
  end if;
  update public.review_requests
  set opened_at = coalesce(opened_at, now()),
      forwarded_at = case when p_event = 'forwarded' then coalesce(forwarded_at, now()) else forwarded_at end,
      status = case when p_event = 'forwarded' or status = 'forwarded' then 'forwarded' else 'google_opened' end
  where id = v_id
  returning status into v_status;
  return v_status;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Painel do proprietário — "Avaliações"
-- ---------------------------------------------------------------------

/**
 * Indicadores dos pedidos de avaliação feitos pelo TapMenu, por período e
 * estabelecimento (só os que o utilizador pode gerir: gestor ou acima).
 * Não contém avaliações publicadas no Google (ainda não sincronizadas).
 */
create or replace function public.get_review_dashboard(
  p_company_id uuid,
  p_restaurant_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_recent_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
  v_limit integer := least(greatest(coalesce(p_recent_limit, 20), 1), 100);
  v_ids uuid[];
begin
  select coalesce(array_agg(r.id), '{}') into v_ids
  from public.restaurants r
  where r.company_id = p_company_id
    and (p_restaurant_id is null or r.id = p_restaurant_id)
    and private.has_restaurant_access(r.id, 30);

  return jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'byRestaurant', coalesce((
      select jsonb_agg(jsonb_build_object(
        'restaurantId', r.id,
        'restaurantName', r.name,
        'hasReviewUrl', r.google_review_url is not null,
        'closedSessions', (select count(*) from public.table_sessions s
                           where s.restaurant_id = r.id and s.status = 'closed' and s.closed_at >= v_from and s.closed_at <= v_to),
        'requestedSessions', (select count(distinct q.table_session_id) from public.review_requests q
                              where q.restaurant_id = r.id and q.presented_at >= v_from and q.presented_at <= v_to),
        'presented', (select count(*) from public.review_requests q
                      where q.restaurant_id = r.id and q.presented_at >= v_from and q.presented_at <= v_to),
        'opened', (select count(*) from public.review_requests q
                   where q.restaurant_id = r.id and q.presented_at >= v_from and q.presented_at <= v_to and q.opened_at is not null),
        'forwarded', (select count(*) from public.review_requests q
                      where q.restaurant_id = r.id and q.presented_at >= v_from and q.presented_at <= v_to and q.forwarded_at is not null)
      ) order by r.name)
      from public.restaurants r where r.id = any (v_ids)), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(x.j order by x.presented_at desc)
      from (
        select q.presented_at, jsonb_build_object(
          'id', q.id,
          'restaurantId', q.restaurant_id,
          'restaurantName', r.name,
          'tableSessionId', q.table_session_id,
          'tableNumber', t.number,
          'provider', q.provider,
          'status', q.status,
          'reviewUrl', q.review_url,
          'deviceType', q.device_type,
          'presentedAt', q.presented_at,
          'openedAt', q.opened_at,
          'forwardedAt', q.forwarded_at) as j
        from public.review_requests q
        join public.restaurants r on r.id = q.restaurant_id
        join public.table_sessions s on s.id = q.table_session_id
        left join public.dining_tables t on t.id = s.table_id
        where q.restaurant_id = any (v_ids) and q.presented_at >= v_from and q.presented_at <= v_to
        order by q.presented_at desc
        limit v_limit
      ) x), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Privilégios (explícitos — novas funções são executáveis por PUBLIC
--    por omissão no PostgreSQL)
-- ---------------------------------------------------------------------
revoke execute on function
  public.get_session_closure(uuid, uuid, text),
  public.track_review_request(uuid, uuid, text),
  public.get_review_dashboard(uuid, uuid, timestamptz, timestamptz, integer)
from public, anon;

grant execute on function
  public.get_session_closure(uuid, uuid, text),
  public.track_review_request(uuid, uuid, text),
  public.get_review_dashboard(uuid, uuid, timestamptz, timestamptz, integer)
to authenticated;

-- O cliente sem conta só usa as funções do ecrã de agradecimento.
grant execute on function
  public.get_session_closure(uuid, uuid, text),
  public.track_review_request(uuid, uuid, text)
to anon;
