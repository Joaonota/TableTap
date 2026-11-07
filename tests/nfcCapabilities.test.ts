import { describe, expect, it } from 'vitest'
import {
  detectBrowserInfo,
  detectDeviceInfo,
  detectOsInfo
} from '@/services/nfc/nfcCapabilities'

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const ANDROID_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 13; SM-G991B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36'
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD_SAFARI =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

describe('detectBrowserInfo', () => {
  it('identifica Chrome no Android como Chromium', () => {
    const browser = detectBrowserInfo(ANDROID_CHROME)
    expect(browser.name).toBe('Chrome (Android)')
    expect(browser.engine).toBe('chromium')
    expect(browser.isWebView).toBe(false)
  })

  it('identifica WebView do Android', () => {
    const browser = detectBrowserInfo(ANDROID_WEBVIEW)
    expect(browser.isWebView).toBe(true)
    expect(browser.name).toMatch(/WebView/)
  })

  it('identifica Safari no iPhone como WebKit (não compatível com Web NFC)', () => {
    const browser = detectBrowserInfo(IPHONE_SAFARI)
    expect(browser.name).toBe('Safari (iOS)')
    expect(browser.engine).toBe('webkit')
  })

  it('identifica desktop Windows como Chromium', () => {
    const browser = detectBrowserInfo(WINDOWS_CHROME)
    expect(browser.engine).toBe('chromium')
  })
})

describe('detectOsInfo / detectDeviceInfo', () => {
  it('deteta Android e telemóvel', () => {
    expect(detectOsInfo(ANDROID_CHROME).name).toBe('Android')
    expect(detectDeviceInfo(ANDROID_CHROME).type).toBe('mobile')
  })

  it('deteta iPhone e iOS', () => {
    expect(detectOsInfo(IPHONE_SAFARI).name).toBe('iOS')
    expect(detectDeviceInfo(IPHONE_SAFARI).type).toBe('mobile')
  })

  it('deteta iPad como tablet', () => {
    expect(detectDeviceInfo(IPAD_SAFARI).type).toBe('tablet')
    expect(detectOsInfo(IPAD_SAFARI).name).toBe('iPadOS')
  })

  it('deteta desktop Windows', () => {
    expect(detectOsInfo(WINDOWS_CHROME).name).toBe('Windows')
    expect(detectDeviceInfo(WINDOWS_CHROME).type).toBe('desktop')
  })

  it('extrai o modelo Android quando presente no user agent', () => {
    expect(detectDeviceInfo(ANDROID_WEBVIEW).model).toBe('SM-G991B')
  })
})
