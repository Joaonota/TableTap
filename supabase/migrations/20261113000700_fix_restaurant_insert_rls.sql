-- =====================================================================
-- TapMenu — 0700 · Corrige a criação de estabelecimentos pelo responsável
--
-- Problema: ao criar um estabelecimento, o cliente faz INSERT ... RETURNING.
-- O RETURNING tem de passar a política de leitura (restaurants_select), que
-- usava apenas private.has_restaurant_access(id). Essa função procura o
-- restaurante na própria tabela e ainda não vê a linha acabada de inserir,
-- pelo que devolvia false e o Postgres recusava o INSERT com 42501
-- ("new row violates row-level security policy").
--
-- Solução: o dono da empresa (ou o Super Admin) lê os estabelecimentos da
-- empresa pela coluna company_id, sem depender da linha nova estar visível.
-- O isolamento mantém-se: só a própria empresa (rank >= 50) passa.
-- =====================================================================

drop policy if exists restaurants_select on public.restaurants;
create policy restaurants_select on public.restaurants for select to authenticated
  using (private.has_restaurant_access(id) or private.has_company_access(company_id, 50));
