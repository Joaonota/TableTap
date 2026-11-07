import { afterEach, describe, expect, it, vi } from 'vitest'
import { RealNfcService } from '@/services/nfc/nfcService'
import { NfcError } from '@/types'

const URL_UNDER_TEST = 'https://tapmenu.app/menu/restaurante/12'

function encoderView(text: string): DataView {
  const bytes = new TextEncoder().encode(text)
  return new DataView(bytes.buffer)
}

function installWindow(readerCtor: unknown) {
  vi.stubGlobal('NDEFReader', readerCtor)
  vi.stubGlobal('window', {
    NDEFReader: readerCtor,
    isSecureContext: true,
    location: { protocol: 'https:' },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RealNfcService.writeUrl', () => {
  it('grava um registo NDEF do tipo url quando o browser confirma', async () => {
    const writes: Array<{ message: any; options: any }> = []
    class FakeReader {
      onreading: ((event: any) => void) | null = null
      onreadingerror: ((event: any) => void) | null = null
      scan() { return Promise.resolve() }
      write(message: any, options: any) {
        writes.push({ message, options })
        return Promise.resolve()
      }
    }
    installWindow(FakeReader)

    const service = new RealNfcService()
    const outcome = await service.writeUrl(URL_UNDER_TEST)

    expect(outcome.writeConfirmedByBrowser).toBe(true)
    expect(outcome.url).toBe(URL_UNDER_TEST)
    expect(writes).toHaveLength(1)
    expect(writes[0].message.records[0]).toMatchObject({ recordType: 'url', data: URL_UNDER_TEST })
    expect(writes[0].options.overwrite).toBe(true)
  })

  it('rejeita URL inválido antes de tocar na API NFC', async () => {
    let writeCalled = false
    class FakeReader {
      onreading: ((event: any) => void) | null = null
      onreadingerror: ((event: any) => void) | null = null
      scan() { return Promise.resolve() }
      write() { writeCalled = true; return Promise.resolve() }
    }
    installWindow(FakeReader)

    const service = new RealNfcService()
    await expect(service.writeUrl('/menu/relativo')).rejects.toMatchObject({ code: 'invalid_url' })
    expect(writeCalled).toBe(false)
  })

  it('traduz NotSupportedError da etiqueta sem marcar sucesso', async () => {
    class FakeReader {
      onreading: ((event: any) => void) | null = null
      onreadingerror: ((event: any) => void) | null = null
      scan() { return Promise.resolve() }
      write() {
        return Promise.reject({ name: 'NotSupportedError', message: 'This tag is not supported.' })
      }
    }
    installWindow(FakeReader)

    const service = new RealNfcService()
    const error = await service.writeUrl(URL_UNDER_TEST).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NfcError)
    expect((error as NfcError).code).toBe('tag_not_supported')
    expect(service.getLastSuccessfulWriteAt()).toBeNull()
  })

  it('não tenta gravar automaticamente mais do que uma vez', async () => {
    let attempts = 0
    class FakeReader {
      onreading: ((event: any) => void) | null = null
      onreadingerror: ((event: any) => void) | null = null
      scan() { return Promise.resolve() }
      write() {
        attempts += 1
        return Promise.reject({ name: 'NetworkError', message: 'Tag removed.' })
      }
    }
    installWindow(FakeReader)

    const service = new RealNfcService()
    await expect(service.writeUrl(URL_UNDER_TEST)).rejects.toMatchObject({ code: 'transfer_failed' })
    expect(attempts).toBe(1)
  })
})

describe('RealNfcService.readTag / verifyUrl', () => {
  it('lê a etiqueta e valida o URL esperado', async () => {
    class FakeReader {
      onreading: ((event: any) => void) | null = null
      onreadingerror: ((event: any) => void) | null = null
      scan() {
        setTimeout(() => {
          this.onreading?.({
            serialNumber: '04A1B2C3',
            message: { records: [{ recordType: 'url', data: encoderView(URL_UNDER_TEST) }] }
          })
        }, 0)
        return Promise.resolve()
      }
      write() { return Promise.resolve() }
    }
    installWindow(FakeReader)

    const service = new RealNfcService()
    const read = await service.readTag()
    expect(read.url).toBe(URL_UNDER_TEST)
    expect(read.serialNumber).toBe('04A1B2C3')

    const result = await service.verifyUrl(URL_UNDER_TEST)
    expect(result.status).toBe('verified')
    expect(result.foundRecordType).toBe('url')
  })

  it('deteta conteúdo diferente do esperado', async () => {
    class FakeReader {
      onreading: ((event: any) => void) | null = null
      onreadingerror: ((event: any) => void) | null = null
      scan() {
        setTimeout(() => {
          this.onreading?.({
            message: { records: [{ recordType: 'url', data: encoderView('https://outro.example/menu/9') }] }
          })
        }, 0)
        return Promise.resolve()
      }
      write() { return Promise.resolve() }
    }
    installWindow(FakeReader)

    const service = new RealNfcService()
    const result = await service.verifyUrl(URL_UNDER_TEST)
    expect(result.status).toBe('different')
    expect(result.foundUrl).toBe('https://outro.example/menu/9')
  })

  it('devolve no_url quando a etiqueta não contém registo URL', async () => {
    class FakeReader {
      onreading: ((event: any) => void) | null = null
      onreadingerror: ((event: any) => void) | null = null
      scan() {
        setTimeout(() => {
          this.onreading?.({
            message: { records: [{ recordType: 'text', data: encoderView('Mesa 12') }] }
          })
        }, 0)
        return Promise.resolve()
      }
      write() { return Promise.resolve() }
    }
    installWindow(FakeReader)

    const service = new RealNfcService()
    const result = await service.verifyUrl(URL_UNDER_TEST)
    expect(result.status).toBe('no_url')
    expect(result.foundUrl).toBeNull()
  })
})

describe('RealNfcService.checkPreconditions', () => {
  it('não afirma suporte quando NDEFReader está ausente', () => {
    vi.stubGlobal('window', {
      isSecureContext: true,
      location: { protocol: 'https:' },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis)
    })
    const service = new RealNfcService()
    expect(service.isSupported()).toBe(false)
    expect(service.checkPreconditions()?.code).toBe('not_supported')
  })

  it('exige HTTPS mesmo com NDEFReader presente', () => {
    class FakeReader {
      onreading: ((event: any) => void) | null = null
      onreadingerror: ((event: any) => void) | null = null
      scan() { return Promise.resolve() }
      write() { return Promise.resolve() }
    }
    vi.stubGlobal('NDEFReader', FakeReader)
    vi.stubGlobal('window', {
      NDEFReader: FakeReader,
      isSecureContext: false,
      location: { protocol: 'http:' },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis)
    })
    const service = new RealNfcService()
    expect(service.checkPreconditions()?.code).toBe('insecure_context')
  })
})
