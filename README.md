# TapMenu

Aplicação SaaS para gestão de menus digitais em restaurantes — Vue 3 + TypeScript + Vite + Pinia.

## Executar

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # build (vue-tsc + vite)
npm run preview  # pré-visualizar build
npm test         # testes (vitest)
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

- `src/domain/`: regras de negócio puras (URL pública, estados de mesa/sessão, etiquetas).
- `src/repositories/`: interfaces e implementação mock (localStorage). O registo único em
  `src/repositories/index.ts` é o ponto de troca para uma API.
- `src/services/`: fachada usada pelas stores.
- `src/stores/`: estado da UI (Pinia).
- UI base em `src/components/ui/`.
