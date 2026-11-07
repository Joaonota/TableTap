export {
  nfcService,
  RealNfcService,
  stateFromError,
  TAG_COMPATIBILITY_ERROR_CODES
} from './nfcService'
export {
  isNfcApiSupported,
  isNfcReadApiSupported,
  isNfcWriteApiSupported,
  isSecureContextForNfc,
  detectNfcCapabilities,
  detectBrowserInfo,
  detectOsInfo,
  detectDeviceInfo,
  getCompatibilitySummary,
  buildNfcDiagnosticReport,
  queryNfcPermissionState
} from './nfcCapabilities'
export { translateNfcException } from './nfcErrors'
export type { NfcErrorTranslationContext } from './nfcErrors'
export {
  buildMenuUrl,
  getMenuUrlPath,
  getPublicBaseUrl,
  normalizeMenuUrl,
  validateNfcUrl
} from './nfcUrl'
export type { NfcUrlValidation } from './nfcUrl'
export {
  nfcAdapters,
  webNfcAdapter,
  getRecommendedAdapter,
  getAdapterAvailability
} from './nfcAdapters'
