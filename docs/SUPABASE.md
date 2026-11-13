# TapMenu + Supabase

O TapMenu usa o Supabase como única fonte de dados: PostgreSQL (dados e regras de negócio),
Auth (contas), Storage (imagens) e Realtime (atualizações ao vivo). Não há servidor próprio nem
dados de demonstração — sem registos na base de dados, as páginas mostram estados vazios.

## 1. Ligar o projeto

1. No Supabase, abra **Project Settings → API Keys** e copie:
   - o **Project URL** (`https://<projeto>.supabase.co`);
   - a chave **publishable** (ou **anon**, em projetos com chaves "legacy").
2. Crie `.env.local` na raiz (já ignorado pelo git) a partir de `.env.example`:

   ```
   VITE_SUPABASE_URL=https://<projeto>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<chave pública>
   ```

   **Nunca** use a chave `service_role` / secreta no frontend. A aplicação deteta-a e recusa arrancar.
3. Em produção (ex.: Vercel), defina as mesmas variáveis no painel do alojamento e
   `VITE_PUBLIC_BASE_URL` com o domínio público (é o que fica gravado nas etiquetas NFC).

## 2. Aplicar as migrations

As migrations estão em `supabase/migrations/` e devem ser aplicadas por ordem:

| Ficheiro | Conteúdo |
|---|---|
| `20261113000100_core_schema.sql` | Tabelas: empresas, restaurantes, utilizadores/equipa, planos, subscrições, mesas, sessões, etiquetas NFC, categorias, produtos, variantes, adicionais, pedidos, itens, pagamentos, atendimento, notificações, personalização, auditoria |
| `20261113000200_security.sql` | Funções de permissão, RLS em todas as tabelas, privilégios por coluna, perfil automático no registo |
| `20261113000300_business_rules.sql` | Limites dos planos (triggers), mesas e sessões, pedidos com preços calculados no servidor, pagamentos, NFC, registo de empresas, convites, pedidos de alteração de plano, auditoria |
| `20261113000400_public_api_storage_realtime.sql` | API pública do menu (cliente sem conta), bucket `media` e políticas de Storage, publicação Realtime |

Com a CLI do Supabase:

```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>
npx supabase db push
```

Sem CLI: **SQL Editor** do Supabase → colar e executar cada ficheiro, pela ordem da tabela.

## 3. Configurar a autenticação

Em **Authentication → URL Configuration**:

- **Site URL**: o domínio da aplicação (ex.: `https://app.tapmenu.co.mz`; em desenvolvimento `http://localhost:5173`).
- **Redirect URLs**: acrescente `<site>/login` e `<site>/redefinir-palavra-passe`.

Em **Authentication → Providers → Email**, mantenha **Confirm email** ativo: os convites de equipa só
são ligados a contas com email confirmado.

## 4. Primeiro Super Admin

O papel de Super Admin nunca é atribuído pela aplicação. Depois de criar a sua conta em `/registo`
(e confirmar o email), execute no **SQL Editor**:

```sql
update public.profiles set is_super_admin = true where email = 'o-seu-email@dominio.com';
```

Termine sessão e volte a entrar. A conta abre em `/super-admin`.

## 5. Primeiros passos na plataforma

1. **Super Admin → Planos Comerciais**: crie os planos (preço, funcionalidades, limites).
2. **Super Admin → Configurações SaaS**: escolha o **plano por omissão** e os dias de teste.
   Sem plano por omissão, o registo self-service de restaurantes fica bloqueado.
3. Os restaurantes registam-se em `/registo` (conta → empresa + primeiro restaurante) ou são
   registados pelo Super Admin em **Empresas** (o responsável é convidado por email).
4. A equipa de cada empresa é adicionada em **Funcionários**: a pessoa cria conta com o mesmo
   email e, depois de o confirmar, fica ligada à empresa com o papel atribuído.

## Papéis e permissões

| Papel | Pode |
|---|---|
| Super Admin (equipa TapMenu) | Tudo, em todas as empresas; planos, subscrições, registo e configuração física de etiquetas NFC |
| Dono da empresa | Todos os restaurantes da empresa, dados da empresa, novos restaurantes, pedir mudança de plano |
| Administrador do restaurante | Restaurantes atribuídos, equipa (até ao seu nível), configurações |
| Gerente | Menu, mesas, etiquetas (associar/desativar), operação |
| Recepcionista / Empregado / Cozinha | Operação: pedidos, sessões, atendimento, ecrã da cozinha |

As permissões são aplicadas pelo **RLS** e pelas funções SQL — a interface apenas esconde o que o
utilizador não pode fazer. Cada empresa só vê os seus dados; os restaurantes só são visíveis para quem
lhes foi atribuído (o dono vê todos).

## Cliente (menu público)

O cliente abre `/m/<restaurante>/<mesa>` (etiqueta NFC ou QR Code) sem conta. Tudo o que faz passa por
funções SQL com regras próprias:

- `get_public_table` / `get_public_menu`: restaurante, mesa, sessão atual e menu publicado;
- `start_table_session` / `join_table_session`: inicia ou junta-se à sessão da mesa. O dispositivo
  recebe um **token** secreto que autoriza os pedidos nessa sessão;
- `place_order`: o navegador envia só produtos, quantidades e opções — **preços, IVA, taxa de serviço
  e total são calculados no servidor**;
- `request_bill`, `create_service_request`, `get_session_orders`, `get_public_order`.

## Pagamentos

Não há gateway de pagamento integrado. Quando o cliente pede a conta e indica o método (M-Pesa,
e-Mola, cartão, numerário), os pedidos ficam **a aguardar confirmação**; a equipa confirma o
recebimento em **Pagamentos** (ou marca o pedido como pago em **Pedidos**). Nada é cobrado
automaticamente.

## Planos

Não há pagamento online de subscrições. O dono da empresa **pede** a mudança de plano em
**Meu Plano**; a equipa TapMenu aplica-a em **Super Admin → Subscrições**. Os limites (mesas, produtos,
categorias, utilizadores, restaurantes) são aplicados pela base de dados no momento da criação.

## Testes da base de dados

`npm run test:db` cria uma base temporária num PostgreSQL local, aplica uma simulação mínima do
Supabase (`supabase/tests/supabase_stub.sql`, só para testes), todas as migrations e os testes de
`supabase/tests/database.test.sql` (isolamento entre empresas, RLS, papéis, limites, sessões, pedidos,
pagamentos, NFC e Storage).

```bash
# variáveis opcionais: PSQL (caminho do psql), TEST_PG_HOST, TEST_PG_PORT, TEST_PG_USER
PSQL="C:/Program Files/PostgreSQL/18/bin/psql.exe" TEST_PG_PORT=5432 npm run test:db
```
