/**
 * Web NFC API — ambient typings (https://w3c-cg.github.io/web-nfc/).
 *
 * TapMenu only uses the experimental subset below. If TypeScript's lib.dom
 * ships full Web NFC types in the future, this file can be removed and the
 * global declarations will take over.
 */

type NDEFRecordData = string | ArrayBuffer | ArrayBufferView

interface NDEFRecordInit {
  recordType?: string
  data?: NDEFRecordData
  encoding?: string
  lang?: string
  id?: string
  mediaType?: string
}

interface NDEFRecordOptions {
  recordType?: string
  data?: NDEFRecordData
  encoding?: string
  lang?: string
  id?: string
  mediaType?: string
}

interface NDEFMessageInit {
  records?: NDEFRecordInit[]
}

interface NDEFRecord {
  readonly recordType: string
  readonly mediaType?: string
  readonly lang?: string
  readonly encoding?: string
  readonly id?: string
  /** Raw payload. For `url` records the DataView holds the URL text. */
  readonly data?: DataView
  toRecords?(): Promise<NDEFRecord[]>
}

interface NDEFMessage {
  readonly records: readonly NDEFRecord[]
}

interface NDEFReadingEventInit extends EventInit {
  serialNumber?: string
  message?: NDEFMessage
}

interface NDEFReadingEvent extends Event {
  /**
   * Hardware serial/UID of the tag when the browser exposes it
   * (never guaranteed — Chrome may omit it; treat as optional data).
   */
  readonly serialNumber?: string
  readonly message: NDEFMessage
}

interface NDEFWriteOptions {
  /**
   * When true, existing records are overwritten without asking.
   * When false/omitted the browser refuses (`NotAllowedError`) if the tag
   * already contains data.
   */
  overwrite?: boolean
  signal?: AbortSignal
}

interface NDEFScanOptions {
  signal?: AbortSignal
}

declare class NDEFReader extends EventTarget {
  constructor()
  /** Starts NFC reading; requires a secure context (HTTPS). */
  scan(options?: NDEFScanOptions): Promise<void>
  /** Queues an NDEF write; resolving when the message is physically written. */
  write(
    message: string | ArrayBuffer | ArrayBufferView | NDEFMessageInit,
    options?: NDEFWriteOptions
  ): Promise<void>
  onreading: ((this: NDEFReader, ev: NDEFReadingEvent) => unknown) | null
  onreadingerror: ((this: NDEFReader, ev: Event) => unknown) | null
  /** Standard EventTarget overloads. */
  addEventListener(
    type: 'reading',
    listener: (ev: NDEFReadingEvent) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: 'readingerror',
    listener: (ev: Event) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void
  removeEventListener(
    type: 'reading',
    listener: (ev: NDEFReadingEvent) => unknown,
    options?: boolean | EventListenerOptions
  ): void
  removeEventListener(
    type: 'readingerror',
    listener: (ev: Event) => unknown,
    options?: boolean | EventListenerOptions
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void
}
