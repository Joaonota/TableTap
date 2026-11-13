# Mesas, sessões e etiquetas NFC

O TapMenu **não grava etiquetas NFC pelo navegador**. Não há Web NFC, `NDEFReader`
nem nenhuma API de NFC do browser no projeto.

O modelo de operação:

1. O restaurante regista as mesas no TapMenu.
2. Cada mesa recebe uma **URL pública permanente**: `https://<domínio>/m/<restaurante>/<mesa>`.
3. A equipa TapMenu grava essa URL na etiqueta física com uma **aplicação externa** de gravação NFC.
4. No TapMenu fica apenas o **registo administrativo** da etiqueta: que etiqueta, em que mesa, com que URL e em que estado.

## URL da mesa

- Construída em `src/domain/publicUrl.ts` a partir do slug do restaurante e do **slug permanente da mesa**
  (`Table.slug`, ex.: `mesa-08`). O slug é gerado na criação e nunca muda. Editar o número ou o nome da
  mesa não invalida a etiqueta.
- Base pública: `VITE_PUBLIC_BASE_URL` (produção) ou o origin atual.
- O QR Code contém exatamente a mesma URL.
- A etiqueta **não é alterada** quando a mesa muda de estado. O estado é consultado no momento do acesso:

```
NFC/QR → /m/:restaurante/:mesa → publicTableService.resolve() → restaurante + mesa + sessão ativa → experiência
```

- A rota antiga `/menu/:restaurante/:numero` continua a funcionar: resolve a mesa pelo número.

## Mesa e sessão

| Estado da mesa | Como acontece |
|---|---|
| `free` (Livre) | sem sessão ativa |
| `occupied` (Ocupada) | **só** através de uma sessão ativa (`start`) |
| `unavailable` (Indisponível) | definido pelo restaurante, ou mesa desativada (`isActive = false`) |

Pedidos pendentes, chamadas de garçom e pedidos de conta **não** são estados da mesa. São indicadores da sessão.

Ciclo de vida: **Livre → (sessão iniciada) → Ocupada → (sessão encerrada/cancelada) → Livre**.

- Sessão (`TableSession`): `active | closed | cancelled`, `startedAt`, `closedAt`, cliente principal,
  `participants[]`, `orderIds[]` e `total` (recalculado a partir dos pedidos não cancelados).
- **Vários telemóveis na mesma mesa** juntam-se à mesma sessão (`join`). Nunca se cria uma mesa por telemóvel.
  Cada dispositivo guarda localmente apenas a sua participação.
- Mesa ocupada **não bloqueia** o menu: o cliente pode ver o menu, adicionar produtos, chamar o garçom e juntar-se à sessão para pedir.

## Etiquetas (`NfcTag`)

Campos: `id` interno, `code` físico (`TAG-00017`), restaurante, mesa, `targetPath` (URL que deve conter),
`configuredPath` (URL que a equipa registou como gravada), estado, `configuredAt`, `updatedAt`.
O histórico fica em `NfcTagEvent`.

| Estado | Significado |
|---|---|
| Pendente | registada; ainda sem configuração física registada |
| Configurada | a equipa registou que gravou a URL da mesa associada |
| Ativa | instalação na mesa confirmada |
| Reatribuição pendente | a URL gravada (`configuredPath`) difere da mesa atual (`targetPath`) e é preciso regravar |
| Desativada | fora de uso; sem mesa |

As regras estão em `src/domain/nfcTagRules.ts` (funções puras, com testes):

- Associar/alterar a mesa de uma etiqueta **nunca gravada** mantém-na *Pendente*, sem impacto físico.
- Reatribuir uma etiqueta **já gravada** para outra mesa coloca-a em *Reatribuição pendente*.
- "Marcar como configurada" é um **registo administrativo** da equipa TapMenu, não uma gravação.
- Uma mesa só pode ter uma etiqueta em uso.

### Onde se gere

- Painel do restaurante: `/app/tags-nfc`. Associar, alterar, reatribuir, remover associação, desativar,
  copiar/abrir a URL, QR Code e histórico.
- Equipa TapMenu (super admin): `/super-admin/etiquetas-nfc`. Também regista novas etiquetas, regista a
  configuração física, confirma a instalação e exporta a lista *A preparar* em CSV
  (Tag, Restaurante, Mesa, URL, Estado) para usar na aplicação externa.

## Arquitetura

```
páginas/componentes → stores (Pinia) → services (src/services) → repositories (interfaces)
                                                                  └─ src/repositories/supabase
```

As regras das etiquetas (estados, associação, reatribuição, histórico) são aplicadas pela base de
dados em funções SQL (`nfc_register_tags`, `nfc_assign_tag`, `nfc_unassign_tag`,
`nfc_mark_tag_configured`, `nfc_activate_tag`, `nfc_disable_tag`, `nfc_reactivate_tag`), em
`supabase/migrations/20261113000300_business_rules.sql`. O registo de etiquetas e a configuração
física só são aceites para a equipa TapMenu (Super Admin); associar, desassociar e desativar exigem
o papel de gerente ou superior no restaurante. Ver `docs/SUPABASE.md`.
