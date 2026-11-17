-- =====================================================================
-- TapMenu — 1100 · Encaminhamento automático para o Google
--
-- Depois de a equipa encerrar a sessão (conta paga e confirmada), o
-- telemóvel do cliente abre automaticamente a página de avaliação do
-- estabelecimento no Google (uma vez por participante).
--
-- Para os números continuarem honestos, distingue-se como o cliente
-- chegou ao Google:
--   redirect_mode = 'automatic' → encaminhado automaticamente no fim da sessão;
--   redirect_mode = 'button'    → tocou em "Avaliar no Google".
-- opened_at passa a significar só "tocou no botão" (cliques reais).
-- Continua a NÃO existir nenhum estado de "avaliação publicada".
-- =====================================================================

alter table public.review_requests
  add column redirect_mode text check (redirect_mode in ('automatic', 'button'));

-- Registos anteriores: só existiam encaminhamentos por botão.
update public.review_requests set redirect_mode = 'button' where opened_at is not null and redirect_mode is null;

/**
 * Regista o que aconteceu no ecrã final:
 *   google_opened   → o cliente tocou em "Avaliar no Google";
 *   forwarded       → depois do toque, o navegador saiu para o Google;
 *   auto_redirected → o TapMenu abriu o Google automaticamente no fim da sessão.
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
  if p_event is null or p_event not in ('google_opened', 'forwarded', 'auto_redirected') then
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
  set opened_at = case when p_event = 'google_opened' then coalesce(opened_at, now()) else opened_at end,
      forwarded_at = case when p_event in ('forwarded', 'auto_redirected') then coalesce(forwarded_at, now()) else forwarded_at end,
      redirect_mode = coalesce(redirect_mode, case when p_event = 'auto_redirected' then 'automatic' else 'button' end),
      status = case
                 when p_event in ('forwarded', 'auto_redirected') or status = 'forwarded' then 'forwarded'
                 else 'google_opened'
               end
  where id = v_id
  returning status into v_status;
  return v_status;
end;
$$;

/**
 * Indicadores dos pedidos de avaliação (ver migração 1000), agora com:
 *   reached        → clientes que chegaram ao Google (automático ou botão);
 *   autoRedirected → encaminhados automaticamente no fim da sessão.
 * "opened" conta apenas toques no botão.
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
        'presented', q.presented,
        'opened', q.opened,
        'forwarded', q.forwarded,
        'autoRedirected', q.auto_redirected,
        'reached', q.reached
      ) order by r.name)
      from public.restaurants r
      cross join lateral (
        select count(*) as presented,
               count(*) filter (where x.opened_at is not null) as opened,
               count(*) filter (where x.forwarded_at is not null) as forwarded,
               count(*) filter (where x.redirect_mode = 'automatic' and x.forwarded_at is not null) as auto_redirected,
               count(*) filter (where x.opened_at is not null or x.forwarded_at is not null) as reached
        from public.review_requests x
        where x.restaurant_id = r.id and x.presented_at >= v_from and x.presented_at <= v_to
      ) q
      where r.id = any (v_ids)), '[]'::jsonb),
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
          'redirectMode', q.redirect_mode,
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
