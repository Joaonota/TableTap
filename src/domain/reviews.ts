/**
 * Avaliações — regras partilhadas entre o menu do cliente, as configurações
 * e o painel "Avaliações".
 *
 * O TapMenu apenas ENCAMINHA o cliente para a página oficial de avaliação
 * do estabelecimento no Google. Não cria avaliações, não as publica e não
 * recolhe credenciais. Os estados abaixo descrevem só o que o TapMenu
 * consegue observar — nunca que o cliente publicou uma avaliação.
 */

/** Estado de um pedido de avaliação (gravado em review_requests.status). */
export type ReviewRequestStatus = 'presented' | 'google_opened' | 'forwarded'

/**
 * Eventos registados pelo telemóvel do cliente:
 *   google_opened   → tocou em "Avaliar no Google";
 *   forwarded       → depois do toque, o navegador saiu para o Google;
 *   auto_redirected → o TapMenu abriu o Google automaticamente no fim da sessão.
 */
export type ReviewTrackEvent = 'google_opened' | 'forwarded' | 'auto_redirected'

/** Como o cliente chegou ao Google. */
export type ReviewRedirectMode = 'automatic' | 'button'

export const REDIRECT_MODE_LABELS: Record<ReviewRedirectMode, string> = {
  automatic: 'Automático',
  button: 'Botão'
}

/** Tempo em que o ecrã de agradecimento fica visível antes de abrir o Google. */
export const AUTO_REDIRECT_DELAY_MS = 2000

/** Estado apresentado no painel; "not_requested" = sessão encerrada sem pedido. */
export type ReviewFunnelState = 'not_requested' | ReviewRequestStatus

export const REVIEW_STATE_LABELS: Record<ReviewFunnelState, string> = {
  not_requested: 'Não solicitado',
  presented: 'Solicitação apresentada',
  google_opened: 'Google aberto',
  forwarded: 'Avaliação encaminhada'
}

export const REVIEW_STATE_DESCRIPTIONS: Record<ReviewFunnelState, string> = {
  not_requested: 'Sessão encerrada sem pedido de avaliação (sem link configurado ou o cliente não voltou a ver o ecrã).',
  presented: 'O ecrã de agradecimento com o botão "Avaliar no Google" foi apresentado ao cliente.',
  google_opened: 'O cliente tocou em "Avaliar no Google".',
  forwarded: 'O cliente foi levado para a página de avaliação do Google (automaticamente no fim da sessão ou depois de tocar no botão). Não confirma que a avaliação foi publicada.'
}

/** Plataformas de avaliação suportadas (preparado para outras no futuro). */
export type ReviewProvider = 'google'

/** Categoria do dispositivo — o único dado do dispositivo que é guardado. */
export type ReviewDeviceType = 'mobile' | 'tablet' | 'desktop'

export const DEVICE_LABELS: Record<ReviewDeviceType, string> = {
  mobile: 'Telemóvel',
  tablet: 'Tablet',
  desktop: 'Computador'
}

/** Deteta a categoria do dispositivo a partir do navegador (sem guardar o user agent). */
export function detectDeviceType(userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): ReviewDeviceType {
  const ua = userAgent.toLowerCase()
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) return 'tablet'
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/.test(ua)) return 'mobile'
  return 'desktop'
}

// ---------------------------------------------------------------------
// Link de avaliação Google
// ---------------------------------------------------------------------

/**
 * Domínios aceites — os mesmos da validação na base de dados
 * (restaurants_google_review_url_valid, migrações 1000 e 1200).
 */
const GOOGLE_REVIEW_URL_PATTERN = new RegExp(
  '^https://(' +
    'g\\.page/' +
    '|search\\.google\\.com/local/writereview\\?' +
    '|(www\\.)?google\\.[a-z]{2,3}(\\.[a-z]{2})?/(maps|search)' +
    '|maps\\.google\\.[a-z]{2,3}(\\.[a-z]{2})?/' +
    '|maps\\.app\\.goo\\.gl/' +
    '|goo\\.gl/maps/' +
    '|g\\.co/kgs/' +
    '|share\\.google/' + // botão "Partilhar" da app Google Maps
    ')',
  'i'
)

/** Place ID do Google (ex.: ChIJN1t_tDeuEmsRUsoyG83frY4). */
const PLACE_ID_PATTERN = /^ChIJ[A-Za-z0-9_-]{10,}$/

/** Link que abre diretamente o formulário de avaliação do Google para um Place ID. */
export function buildGoogleReviewUrlFromPlaceId(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId.trim())}`
}

export type GoogleReviewUrlCheck =
  | { ok: true; url: string; kind: 'direct_review' | 'business_profile' | 'maps' }
  | { ok: false; error: string }

/**
 * Valida (e normaliza) o que o proprietário escreveu:
 *  - vazio → sem link (válido: o pedido de avaliação fica desligado);
 *  - Place ID → converte para o link direto do formulário de avaliação;
 *  - URL → tem de ser https e de um domínio oficial do Google.
 */
export function checkGoogleReviewInput(raw: string): GoogleReviewUrlCheck | { ok: true; url: '' } {
  const value = (raw ?? '').trim()
  if (!value) return { ok: true, url: '' }

  if (PLACE_ID_PATTERN.test(value)) {
    return { ok: true, url: buildGoogleReviewUrlFromPlaceId(value), kind: 'direct_review' }
  }

  let url = value
  if (/^http:\/\//i.test(url)) url = url.replace(/^http:\/\//i, 'https://')
  if (!/^https:\/\//i.test(url)) url = `https://${url}`

  if (/\s/.test(url) || url.length > 2048) {
    return { ok: false, error: 'O link não pode ter espaços e deve ter no máximo 2048 caracteres.' }
  }
  try {
    new URL(url)
  } catch {
    return { ok: false, error: 'Endereço inválido. Copie o link completo a partir do Google.' }
  }
  if (!GOOGLE_REVIEW_URL_PATTERN.test(url)) {
    return {
      ok: false,
      error:
        'Use o link oficial do Google: o link "Pedir avaliações" (https://g.page/r/…/review) ou o link de partilha do Google Maps (https://maps.app.goo.gl/… ou https://share.google/…).'
    }
  }

  const kind = /writereview|\/review\b/i.test(url)
    ? 'direct_review'
    : /g\.page\//i.test(url)
      ? 'business_profile'
      : 'maps'
  return { ok: true, url, kind }
}
