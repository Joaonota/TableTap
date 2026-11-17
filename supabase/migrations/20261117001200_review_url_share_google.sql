-- =====================================================================
-- TapMenu — 1200 · Aceitar links de partilha "share.google"
--
-- O botão "Partilhar" da app Google Maps passou a gerar links
-- https://share.google/… — são links oficiais do Google para o local e
-- devem ser aceites como link de avaliação do estabelecimento.
-- Mesmos domínios que src/domain/reviews.ts.
-- =====================================================================

alter table public.restaurants drop constraint restaurants_google_review_url_valid;

alter table public.restaurants
  add constraint restaurants_google_review_url_valid check (
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
        || '|share\.google/'                             -- botão "Partilhar" do Google Maps
        || ')')
    )
  );
