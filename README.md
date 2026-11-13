# TapMenu

Aplicação SaaS para gestão de menus digitais em restaurantes — Vue 3 + TypeScript + Vite + Pinia,
com Supabase (PostgreSQL, Auth, Storage e Realtime). Sem dados de demonstração: tudo vem da base de dados.

## Configurar

1. `cp .env.example .env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
   (só a chave **pública**).
2. Aplique as migrations de `supabase/migrations/` no projeto Supabase.
3. Siga `docs/SUPABASE.md` (autenticação, primeiro Super Admin, planos).

Sem as variáveis, a aplicação mostra uma página a explicar o que falta.

## Executar

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # build (vue-tsc + vite)
npm run preview  # pré-visualizar build
npm test         # testes das regras de domínio (vitest)
npm run test:db  # testes da base de dados: RLS, isolamento e regras (PostgreSQL local)
```

## Mesas, sessões e etiquetas NFC

O TapMenu **não grava etiquetas NFC pelo navegador**. Cada mesa tem uma URL pública permanente
(`/m/<restaurante>/<mesa>`). A equipa TapMenu grava essa URL nas etiquetas com uma aplicação externa,
e o TapMenu gere o registo administrativo das etiquetas e o estado das mesas e das sessões.

- Documentação: `docs/NFC.md`
- Restaurante: `/app/mesas`, `/app/tags-nfc`
- Equipa TapMenu: `/super-admin/etiquetas-nfc`
- Variável opcional: `VITE_PUBLIC_BASE_URL` (domínio HTTPS público usado nas URLs das mesas)

## Arquitetura

```
páginas/componentes → stores (Pinia) → services (src/services) → repositories (interfaces)
                                                                  └─ src/repositories/supabase
```

- `supabase/migrations/`: estrutura, RLS e regras de negócio (limites, sessões, pedidos, NFC).
- `src/lib/supabase.ts`: cliente único (chave pública).
- `src/repositories/supabase/`: todas as consultas ao Supabase e conversão de dados (mappers).
- `src/services/`: fachada usada pelas stores.
- `src/stores/`: estado da UI (Pinia), com Realtime para pedidos, mesas, atendimento e notificações.
- `src/domain/`: regras puras partilhadas pela UI (URL pública, estados, limites).
- UI base em `src/components/ui/`.

Detalhes: `docs/SUPABASE.md`.
