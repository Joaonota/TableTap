# NFC REAL — Documentação do Módulo

O módulo de Acesso Digital do TapMenu grava **URLs reais em etiquetas NFC físicas** com a
**Web NFC API** (`NDEFReader`), faz **leitura real** para verificação e substituiu a antiga
simulação de escrita (OTP/PIN) por operações honestas.

## 1. Como funciona (arquitetura)

```
src/services/nfc/           ← ÚNICO local que usa a Web NFC API
├── nfcService.ts           RealNfcService: writeNdefUrl / readTag / verifyUrl / cancelNfcSession
├── nfcCapabilities.ts      Capabilities + Permissions API (apiSupported, secureContext, permissão)
├── nfcErrors.ts            translateNfcException → NfcError (mensagens + código + detalhe técnico)
├── nfcUrl.ts               buildMenuUrl / getMenuUrlPath / normalizeMenuUrl / getPublicBaseUrl
└── index.ts                Barrel público

src/stores/nfc.ts           useNfcStore: registo local de etiquetas (localStorage)
                            tapmenu_nfc_registry_v2 (+ migrate/remove legacy v1)
src/types/nfc.ts            NFCTagRecord, NfcOpState, NFCVerifyResult, NfcError,…
src/types/web-nfc.d.ts      Typings ambient da API Web NFC
```

Componentes (`src/components/nfc/`): `NFCStatus` (banner de capacidades), `NFCDiagnostics`
(matríz de suporte + teste de leitura), `NFCReader`, `NFCVerification`, `NFCHistory`,
`NfcWriteWizardModal` (gravação real), `NfcLockModal`/`NfcUnlockModal` (proteção **no sistema**),
`NfcDetailsModal`, `NfcTimelineView`.
Página: `src/pages/digital-access/DigitalAccessPage.vue` (abas: Gestão, Histórico, Testar NFC, QR).

## 2. Fluxo de gravação real

1. **Configuração** — restaurante + mesa; o URL do menu é construído a partir dos dados:
   `getPublicBaseUrl() + /menu/{restaurantSlug}/{tableNumber}`.
2. **Etapa física (`nfcService.writeNdefUrl`)** — `scan()` → `onWaiting` ("Pronto para gravar")
   → `onreading` (`onTagDetected`+`onWriting`) →
   `write({ records: [{ recordType: 'url', data: url }] }, { overwrite: true, signal })`.
   **A promise só resolve quando o browser confirma a escrita no chip** — nunca é falsificada.
3. **Retravação em regravação** — wizard exige o checkbox *"Confirmo a substituição do conteúdo
   físico"* (mensagem: "Esta operação substituirá o conteúdo atual da etiqueta NFC.").
4. **Etiqueta protegida (status `protected`)** — botão desativado com o aviso
   *"Etiqueta protegida contra alterações."*; qualquer tentativa é registrada como
   `write_rejected` no histórico.
5. **Verificação real** — após a escrita, `verifyUrl(url)` faz uma **nova leitura** (`readTag`)
   e compara o URL físico com o esperado; só `verified` quando é igual:
   - `verified` → evento `verified`, `lastVerifiedAt`, toast de sucesso;
   - `different` / `no_url` → evento `verify_failed` + toast de aviso ("não validada") —
     a UI nunca afirma validação sem confirmação;
   - `unreadable`/`cancelled` (leitura falhou) → evento honesto + botão **"Verificar agora"**.
6. **Cancelar** — `AbortController` cancela scan/write em curso → estado `cancelled`
   (registrado no histórico como `cancelled`, não como falha).

## 3. Modelo de dados honesto (`NFCTagRecord`)

| Campo | Semântica |
|---|---|
| `serialNumber: string \| null` | Serial físico **apenas quando o browser o fornece**; caso contrário: *"Identificador físico não disponibilizado pelo navegador."* |
| `hardwareName: null` | A Web NFC não expõe o modelo do chip — é sempre `null` |
| `ndefType` | `NDEF URI (Well-Known RTD)` |
| `status` | `unassigned` → `active` (após escrita física) → `protected` / `failed` |
| `protection` | `'none' \| 'system'` — proteção **no sistema** apenas |
| `writeCount`, `lastWrittenAt`, `lastVerifiedAt`, `lastOperation` | Métricas reais |

## 4. Proteção — limitação física honesta

`HARDWARE_LOCK_NOTE` (em `stores/nfc.ts`):

> Bloqueio físico por hardware (read-only permanente) não é suportado pela Web NFC API neste
> dispositivo/navegador.

A "proteção" do TapMenu significa: o sistema recusa gravar na etiqueta e registra tentativas
bloqueadas. O chip continua fisicamente gravável por outras ferramentas — isso é exibido
explicitamente nos modais de Proteger/Detalhes (sem alegação de bloco OTP quase permanente).

## 5. Compatibilidade

| Contexto | Gravação/Leitura | Alternativa |
|---|---|---|
| Android Chrome/Edge (HTTPS) | ✅ Web NFC | — |
| ChromeOS | ✅ | — |
| Desktop (Windows/macOS/Linux) | ❌ (sem NFC UI) | QR Code completo |
| iOS / Safari / Firefox | ❌ (não implementam Web NFC) | QR Code completo |

Requisitos: `NDEFReader` presente, **HTTPS** (ou `localhost`), NFC ativado no dispositivo,
etiqueta NDEF compatível (NTAG213/215/216, etc.).

## 6. Configuração

`.env` (opcional, veja `.env.example`):

```
VITE_PUBLIC_BASE_URL=https://app.tapmenu.co.mz
```

- Em produção defina o domínio público HTTPS — é o valor gravado no chip;
  sem a variável, é usado `window.location.origin`.

## 7. Testar o funcionamento real (checklist de 14 testes)

Execute num telemóvel Android com Chrome, NFC ativado, via HTTPS (ex.: `chrome://inspect`
port-forward ou anfitrião público). Abra **Acesso Digital** e rode:

1. **Gravação inicial** — "Gravar NFC" numa mesa → encoste etiqueta → estado
   "Gravando..." → escrita termina.
2. **Verificação automática** — re-encoste a etiqueta; o estado deve ficar
   "Etiqueta verificada com sucesso." + evento `verified`.
3. **Regravação** — botão "Regravar" → aparece o aviso de substituição + checkbox obrigatória.
4. **Verificação pós-regravação** — novo URL confirma (`verified`); `writeCount` incrementa.
5. **Cancelar/Abortar** — encoste a etiqueta e cancele antes da escrita terminar →
   erro traduzido e evento `cancelled`.
6. **Etiqueta protegida** — "Proteger"; nos detalhes "Testar Recusa" → evento
   `write_rejected`; tentar gravar → toast de recusa (botão desativado no wizard).
7. **Desproteger** — remover proteção volta a permitir gravação.
8. **Leitura simples** — aba "Testar NFC" → Confirma URL/serial/registos NDEF.
9. **Ausência física** — disparo escrita sem encostar etiqueta → mensagem de espera;
   cancele manualmente.
10. **Uma leitura com URL "diferente"** — grava outro URL e verifica → estado
    "different" / 'verify_failed', toast de aviso honesto e evento no histórico.
11. **História global** — todos os eventos acima aparecem com ator/timestamp.
12. **QR** — código da mesa abre o mesmo URL (output idêntico ao gravado).
13. **Sem HTTPS** (ex.: IP lan em HTTP) — banner indica "página HTTPS não ativa"
    e NFC desativa; QR continua funcional.
14. **Desktop sem NFC** — banner declara não-suporte, o wizard mantém URL/QR funcionais
    e desativa apenas o passo físico.

## 8. Modularidade

- Nenhum `NDEFReader` fora de `src/services/nfc/`.
- Proteção/estado nunca simulam hardware — os eventos do timeline descrevem sempre
  o que aconteceu fisicamente.
- O registo local pode ser limpo de forma transparente ("Limpar Registo Local").
