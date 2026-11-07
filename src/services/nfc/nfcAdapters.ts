import type { NfcAdapterAvailability, NFCWriterAdapter } from '@/types'
import { nfcService } from './nfcService'

/**
 * Arquitetura de adaptadores de gravação NFC.
 *
 * A implementação Web NFC é a única ativa nesta versão. Os restantes métodos
 * estão declarados como NÃO implementados — nunca são apresentados como
 * integrações funcionais.
 */

export const webNfcAdapter: NFCWriterAdapter = nfcService

const ANDROID_NATIVE_NOTE =
  'Aplicação Android nativa ainda não implementada. O URL pode ser exportado para gravação numa app dedicada.'

const EXTERNAL_WRITER_NOTE =
  'Gravação manual com uma ferramenta externa (ex.: NFC Tools) usando o URL copiado/QR Code. Sem integração automática.'

const ANDROID_NATIVE_ADAPTER: NFCWriterAdapter = {
  id: 'android-native',
  label: 'Aplicação Android nativa',
  implemented: false,
  isSupported: () => false,
  writeUrl: async () => {
    throw new Error(ANDROID_NATIVE_NOTE)
  },
  readTag: async () => {
    throw new Error(ANDROID_NATIVE_NOTE)
  }
}

const EXTERNAL_WRITER_ADAPTER: NFCWriterAdapter = {
  id: 'external-writer',
  label: 'Ferramenta externa de gravação NFC',
  implemented: false,
  isSupported: () => false,
  writeUrl: async () => {
    throw new Error(EXTERNAL_WRITER_NOTE)
  },
  readTag: async () => {
    throw new Error(EXTERNAL_WRITER_NOTE)
  }
}

export const nfcAdapters: NFCWriterAdapter[] = [
  webNfcAdapter,
  ANDROID_NATIVE_ADAPTER,
  EXTERNAL_WRITER_ADAPTER
]

/** Adaptador atualmente utilizável (Web NFC) ou null. */
export function getRecommendedAdapter(): NFCWriterAdapter | null {
  return webNfcAdapter.isSupported() && nfcService.isSecureContext()
    ? webNfcAdapter
    : null
}

export function getAdapterAvailability(): NfcAdapterAvailability[] {
  return [
    {
      id: 'web-nfc',
      label: webNfcAdapter.label,
      implemented: true,
      supported: webNfcAdapter.isSupported() && nfcService.isSecureContext(),
      note: webNfcAdapter.isSupported()
        ? 'Método atual: gravação NDEF diretamente no navegador.'
        : 'Web NFC API indisponível neste navegador/dispositivo.'
    },
    {
      id: 'android-native',
      label: ANDROID_NATIVE_ADAPTER.label,
      implemented: false,
      supported: false,
      note: ANDROID_NATIVE_NOTE
    },
    {
      id: 'external-writer',
      label: EXTERNAL_WRITER_ADAPTER.label,
      implemented: false,
      supported: false,
      note: EXTERNAL_WRITER_NOTE
    }
  ]
}
